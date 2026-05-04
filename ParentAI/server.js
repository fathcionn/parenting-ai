require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

function buildStrictJsonPrompt(language, transcript) {
  const transcriptText = transcript || 'Listen to the attached audio and transcribe the parent speech.';

  return `
You are a parenting coach AI. Analyze this transcript.
Return ONLY a raw JSON object - no markdown, no code blocks, no explanation, just the JSON.
Write summary, strengths, improvements, and tips in ${language}.

Transcript:
"""
${transcriptText}
"""

Required JSON format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence summary>",
  "strengths": ["<item>", "<item>"],
  "improvements": ["<item>", "<item>"],
  "tips": ["<item>", "<item>"]
}`;
}

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
      return {
        score: 50,
        summary: 'Session completed. Analysis could not be fully processed.',
        strengths: ['Engaged in a coaching session'],
        improvements: ['Continue practicing regularly'],
        tips: ['Try recording a longer session for better analysis'],
      };
    }
  }
};

function extractSafeJson(result) {
  const rawText = result.response.text().trim();
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
    transcript: parsed.transcript || '',
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const languageNames = { en: 'English', ar: 'Arabic', tr: 'Turkish' };
    const langName = languageNames[language] || 'English';

    const prompt = buildStrictJsonPrompt(langName, transcript);

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });
    res.json(extractSafeJson(result));
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = buildStrictJsonPrompt(promptLanguage);

    const result = await model.generateContent({
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

    res.json(extractSafeJson(result));
  } catch (err) {
    console.error('Gemini audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
