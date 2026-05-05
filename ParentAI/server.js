require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
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

const callGeminiWithTimeout = async (model, prompt) => {
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.stringify(fallbackAnalysis));
    }, 30000);
  });

  const geminiPromise = model.generateContent(prompt).then((result) => result.response.text());
  return Promise.race([geminiPromise, timeoutPromise]);
};

const parseGeminiResponse = (rawText) => {
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
  console.log('RAW GEMINI RESPONSE:', rawText.substring(0, 600));
  console.log('Gemini raw response:', rawText.substring(0, 300));

  const parsed = parseGeminiResponse(rawText);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const languageNames = { en: 'English', ar: 'Arabic', tr: 'Turkish' };
    const langName = languageNames[language] || 'English';

    const prompt = buildStrictJsonPrompt(langName, transcript);

    const responseText = await callGeminiWithTimeout(model, prompt);
    res.json(extractSafeJson(responseText, transcript));
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, audio, mimeType, language, lang } = req.body;
    const audioPayload = audioBase64 || audio;
    const promptLanguage = language || lang || 'English';

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = buildStrictJsonPrompt(promptLanguage);

    const resultPromise = model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioPayload,
              },
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const responseText = await Promise.race([
      resultPromise.then((result) => result.response.text()),
      new Promise((resolve) => setTimeout(() => resolve(JSON.stringify(fallbackAnalysis)), 30000)),
    ]);

    res.json(extractSafeJson(responseText));
  } catch (err) {
    console.error('Gemini audio error:', err);
    res.status(500).json({ error: err.message });
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
