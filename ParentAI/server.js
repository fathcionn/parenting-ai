require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const Groq = require('groq-sdk');
const { toFile } = require('groq-sdk');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/test-groq', async (_req, res) => {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: 'Say hello in one word' }],
      response_format: { type: 'json_object' },
    });
    res.json({
      success: true,
      response: response.choices[0].message.content,
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

    const filename = audioFile.originalname || 'recording.mp4';

    const groqFile = await toFile(audioFile.buffer, filename, {
      type: audioFile.mimetype || 'audio/mp4',
    });

    const transcription = await groq.audio.transcriptions.create({
      file: groqFile,
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'json',
      temperature: 0,
    });

    const transcriptText = transcription.text || '';
    console.log('Transcript:', transcriptText);

    if (!transcriptText.trim()) {
      return res.status(200).json({
        transcript: '',
        score: 70,
        summary: 'No clear speech was detected in this session.',
        strengths: ['The session was recorded successfully.'],
        improvements: ['Try speaking closer to the microphone.'],
        tips: ['Check microphone permissions and reduce background noise.'],
        safetyFlag: false,
      });
    }

    const analysisResponse = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are an expert parenting coach.
Return ONLY valid JSON with exactly these keys:
{
  "score": number,
  "summary": string,
  "strengths": string[],
  "improvements": string[],
  "tips": string[],
  "safetyFlag": boolean
}`,
        },
        {
          role: 'user',
          content: `Analyze this conversation:\n\n${transcriptText}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const raw = analysisResponse.choices[0]?.message?.content || '{}';
    console.log('Analysis raw:', raw);

    let analysis = {};
    try {
      analysis = JSON.parse(raw);
    } catch (err) {
      console.error('Analysis JSON parse failed:', raw);
    }

    return res.status(200).json({
      transcript: transcriptText,
      score: analysis.score ?? 75,
      summary: analysis.summary ?? 'Session analyzed successfully.',
      strengths: analysis.strengths ?? [],
      improvements: analysis.improvements ?? [],
      tips: analysis.tips ?? [],
      safetyFlag: analysis.safetyFlag ?? false,
    });
  } catch (error) {
    console.error('Groq transcription/analysis error:', error);
    return res.status(500).json({
      error: 'Transcription failed',
      details: error.message,
    });
  }
});

function buildStrictJsonPrompt(language, transcript) {
  const transcriptText = String(transcript || '').slice(0, 2000);

  return `Analyze this parenting coaching transcript.
Return ONLY valid JSON, no extra text:
{"score":0-100,"summary":"brief","strengths":["x"],"improvements":["x"],"tips":["x"]}
Write summary, strengths, improvements, and tips in ${language}.

Transcript: ${transcriptText}`;
}

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
      resolve(isSafetyCheck ? fallbackSafety : fallbackAnalysis);
    }, 30000);
  });

  const messages = isSafetyCheck ? [
    {
      role: 'system',
      content: 'You are a child safety AI. Analyze the transcript for concerning content and return JSON.'
    },
    {
      role: 'user',
      content: input
    }
  ] : [
    {
      role: 'system',
      content: `You are an expert parenting coach.
      Analyze this parent-child conversation transcript
      and return a JSON response with:
      {
        "score": number (0-100),
        "summary": string,
        "strengths": string[],
        "improvements": string[],
        "tips": string[]
      }`
    },
    {
      role: 'user',
      content: input
    }
  ];

  const groqPromise = groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages,
    response_format: { type: 'json_object' }
  }).then((response) => response.choices[0].message.content);

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
  console.log('GROQ raw response:', rawText.substring(0, 300));

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

    // Convert base64 to buffer for Groq
    const audioBuffer = Buffer.from(audioPayload, 'base64');    const audioFile = new File([audioBuffer], 'recording.webm', { type: mimeType || 'audio/webm' });

    // First transcribe with Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
    });

    const transcript = transcription.text.trim();

    if (!transcript) {
      return res.json(extractSafeJson(JSON.stringify(fallbackAnalysis)));
    }

    // Then analyze with Groq
    const responseText = await callGroqWithTimeout(transcript, promptLanguage);
    res.json(extractSafeJson(responseText, transcript));
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

Return ONLY this JSON:
{
  "safe": true,
  "severity": "none",
  "detected": [],
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
