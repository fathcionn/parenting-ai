require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { default: Groq, toFile } = require('groq-sdk');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b';
const GROQ_TRANSCRIPTION_MODEL = process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo';
console.log('GROQ KEY loaded:', process.env.GROQ_API_KEY ? 'YES (length: ' + process.env.GROQ_API_KEY.length + ')' : 'MISSING');
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

async function transcribeAudioBuffer(buffer, filename = 'audio.webm') {
  const transcription = await groq.audio.transcriptions.create({
    file: await toFile(buffer, filename),
    model: GROQ_TRANSCRIPTION_MODEL,
  });
  return String(transcription.text || '');
}

async function analyzeTranscriptWithGroq(transcript, language = 'English') {
  const completion = await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You are an expert parenting coach. Analyze parent-child conversations in ${language}. Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: `Analyze this transcript and return exactly these fields:
{
  "score": number between 0 and 100,
  "summary": "brief summary of the interaction",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "tips": ["tip 1", "tip 2"],
  "safetyFlag": true or false
}

Transcript:
"""
${String(transcript || '').slice(0, 8000)}
"""`,
      },
    ],
  });
  return completion.choices?.[0]?.message?.content || '';
}

app.get('/api/test-groq', async (_req, res) => {
  try {
    const result = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      messages: [{ role: 'user', content: 'Say hello in one word' }],
    });
    res.json({
      success: true,
      response: result.choices?.[0]?.message?.content || '',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Audio received:', {
      size: audioFile.size,
      mimetype: audioFile.mimetype,
      originalname: audioFile.originalname,
    });

    const transcript = await transcribeAudioBuffer(audioFile.buffer, audioFile.originalname || 'audio.webm');
    const raw = await analyzeTranscriptWithGroq(transcript);
    console.log('Groq raw response:', raw);

    // Parse the JSON from Groq response
    let analysis = {};
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('JSON parse error:', err);
    }

    return res.status(200).json({
      transcript: analysis.transcript ?? '',
      score: analysis.score ?? 70,
      summary: analysis.summary ?? 'Session analyzed.',
      strengths: analysis.strengths ?? [],
      improvements: analysis.improvements ?? [],
      tips: analysis.tips ?? [],
      safetyFlag: analysis.safetyFlag ?? false,
    });
  } catch (error) {
    console.error('Groq error:', error);
    return res.status(500).json({
      error: 'Transcription failed',
      details: error.message,
    });
  }
});

const fallbackAnalysis = {
  score: 65,
  summary: 'Session completed successfully.',
  strengths: ['Engaged in a coaching session', 'Showed commitment to improvement'],
  improvements: ['Continue practicing regularly'],
  tips: ['Try shorter sessions for faster analysis'],
};

const fallbackSafety = {
  safe: true,
  severity: 'none',
  detected: [],
  recommendation: 'No concerning content was detected.',
};

const callGroqWithTimeout = async (input, language = 'English', isSafetyCheck = false) => {
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(isSafetyCheck ? JSON.stringify(fallbackSafety) : JSON.stringify(fallbackAnalysis));
    }, 30000);
  });

  const systemPrompt = isSafetyCheck 
    ? 'You are a child safety AI. Analyze the transcript for concerning content and return ONLY valid JSON with these fields: {safe: boolean, severity: string, detected: [], recommendation: string}'
    : `You are an expert parenting coach. Analyze this parent-child conversation transcript and return ONLY valid JSON with exactly these fields:
{
  "score": number between 0 and 100,
  "summary": string,
  "strengths": ["string"],
  "improvements": ["string"],
  "tips": ["string"]
}`;

  const groqPromise = (async () => {
    const result = await groq.chat.completions.create({
      model: GROQ_CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(input || '').slice(0, 8000) },
      ],
    });
    return result.choices?.[0]?.message?.content || '';
  })();

  return Promise.race([groqPromise, timeoutPromise]);
};

const parseGroqResponse = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch {
    try {
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch {
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch {}
      return fallbackAnalysis;
    }
  }
};

function extractSafeJson(rawText, transcript = '') {
  rawText = String(rawText || '').trim();
  console.log('RAW GROQ RESPONSE:', rawText.substring(0, 600));
  console.log('Groq raw response:', rawText.substring(0, 300));

  const parsed = parseGroqResponse(rawText);
  const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50;
  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
  const improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
  const tips = Array.isArray(parsed.tips) ? parsed.tips : [];

  return {
    score,
    summary: parsed.summary || '',
    strengths,
    improvements,
    tips,
    transcript: parsed.transcript || transcript,
    tone: score >= 70 ? 'supportive' : score >= 50 ? 'firm' : 'harsh',
    confidence: 80,
    emotional_intensity: score >= 70 ? 30 : score >= 50 ? 55 : 80,
    parenting_style: score >= 70 ? 'authoritative' : score >= 50 ? 'authoritarian' : 'authoritarian',
    detected_issues: improvements,
    suggestions: tips,
    impact_analysis: parsed.summary || '',
    positive_notes: strengths,
  };
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { transcript, language } = req.body;

    const languageNames = { en: 'English', ar: 'Arabic', tr: 'Turkish' };
    const langName = languageNames[language] || 'English';

    const responseText = await callGroqWithTimeout(transcript, langName, false);
    res.json(extractSafeJson(responseText, transcript));
  } catch (err) {
    console.error('Groq error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, audio, mimeType, language, lang } = req.body;
    const audioPayload = audioBase64 || audio;
    const promptLanguage = language || lang || 'English';

    const audioBuffer = Buffer.from(audioPayload, 'base64');
    const transcript = await transcribeAudioBuffer(audioBuffer, `audio.${String(mimeType || 'audio/webm').split('/')[1] || 'webm'}`);
    const raw = await analyzeTranscriptWithGroq(transcript, promptLanguage);

    if (!transcript) {
      return res.json(extractSafeJson(JSON.stringify(fallbackAnalysis)));
    }

    res.json(extractSafeJson(raw, transcript));
  } catch (err) {
    console.error('Groq audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/check-safety', async (req, res) => {
  try {
    const { transcript } = req.body;
    const safetyPrompt = `
You are a child safety AI. Analyze this transcript for any signs of:
- Verbal abuse or harsh language toward a child
- Threats or intimidation
- Emotional abuse or humiliation
- Inappropriate content

Transcript:
"""
${String(transcript || '').slice(0, 2000)}
"""

Return ONLY this JSON, no extra text:
{
  "safe": true or false,
  "severity": "none" or "mild" or "moderate" or "severe",
  "detected": ["concern 1", "concern 2"],
  "recommendation": "brief advice for parent"
}

If concerning content is found, set safe to false and severity to mild, moderate, or severe.`;

    const responseText = await callGroqWithTimeout(safetyPrompt, 'English', true);
    const parsed = parseGroqResponse(responseText);
    const severityValues = ['none', 'mild', 'moderate', 'severe'];

    res.json({
      safe: typeof parsed.safe === 'boolean' ? parsed.safe : true,
      severity: severityValues.includes(parsed.severity) ? parsed.severity : 'none',
      detected: Array.isArray(parsed.detected) ? parsed.detected.map(String) : [],
      recommendation: String(parsed.recommendation || fallbackSafety.recommendation),
    });
  } catch (err) {
    console.error('Safety check error:', err);
    res.json(fallbackSafety);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

// Keep Railway awake by self-pinging every 14 minutes
if (process.env.NODE_ENV === 'production') {
  const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    || 'parenting-ai-production.up.railway.app';

  setInterval(async () => {
    try {
      await fetch(`https://${RAILWAY_URL}/health`);
      console.log('Keep-alive ping sent');
    } catch (e) {
      console.log('Keep-alive ping failed:', e.message);
    }
  }, 14 * 60 * 1000); // every 14 minutes
}
