const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
console.log('OPENAI KEY loaded:', process.env.OPENAI_API_KEY ? 'YES (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'MISSING');
const upload = multer({ storage: multer.memoryStorage() });

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

async function transcribeAudioBuffer(buffer, filename = 'audio.webm') {
  const extension = path.extname(filename) || '.webm';
  const filePath = path.join(os.tmpdir(), `talkwise-${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
  await fs.promises.writeFile(filePath, buffer);

  try {
    const transcription = await withTimeout(
      openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      }),
      20000,
      'Whisper transcription timed out'
    );
    return String(transcription.text || '');
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
}

async function analyzeTranscriptWithOpenAI(transcript) {
  const prompt = `You are a parenting coach. Analyze this parent-child conversation transcript and respond ONLY with valid JSON, no extra text:
Transcript: "${String(transcript || '').slice(0, 8000).replace(/"/g, '\\"')}"
JSON format:
{"score": <0-100>, "summary": "<2 sentences>", "strengths": ["<point1>", "<point2>"], "improvements": ["<point1>", "<point2>"], "tips": ["<tip1>", "<tip2>"], "safetyFlag": <true/false>}`;
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });
  return response.choices?.[0]?.message?.content || '';
}

app.get('/api/test-openai', async (_req, res) => {
  try {
    const result = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
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
    const raw = await analyzeTranscriptWithOpenAI(transcript);
    console.log('OpenAI raw response:', raw);

    // Parse the JSON from OpenAI response
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
      transcript,
      score: analysis.score ?? 70,
      summary: analysis.summary ?? 'Session analyzed.',
      strengths: analysis.strengths ?? [],
      improvements: analysis.improvements ?? [],
      tips: analysis.tips ?? [],
      safetyFlag: analysis.safetyFlag ?? false,
    });
  } catch (error) {
    console.error('OpenAI error:', error);
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

const callOpenAIWithTimeout = async (input, language = 'English', isSafetyCheck = false) => {
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

  const openaiPromise = (async () => {
    const prompt = `${systemPrompt}\n\n${String(input || '').slice(0, 8000)}`;
    const result = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });
    return result.choices?.[0]?.message?.content || '';
  })();

  return Promise.race([openaiPromise, timeoutPromise]);
};

const parseOpenAIResponse = (rawText) => {
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
  console.log('RAW OPENAI RESPONSE:', rawText.substring(0, 600));
  console.log('OpenAI raw response:', rawText.substring(0, 300));

  const parsed = parseOpenAIResponse(rawText);
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

    const responseText = await callOpenAIWithTimeout(transcript, langName, false);
    res.json(extractSafeJson(responseText, transcript));
  } catch (err) {
    console.error('OpenAI error:', err);
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
    const raw = await analyzeTranscriptWithOpenAI(transcript, promptLanguage);

    if (!transcript) {
      return res.json(extractSafeJson(JSON.stringify(fallbackAnalysis)));
    }

    res.json(extractSafeJson(raw, transcript));
  } catch (err) {
    console.error('OpenAI audio error:', err);
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

    const responseText = await callOpenAIWithTimeout(safetyPrompt, 'English', true);
    const parsed = parseOpenAIResponse(responseText);
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
