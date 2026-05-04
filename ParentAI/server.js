require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

function buildStrictJsonPrompt(language, transcript) {
  const transcriptInstruction = transcript
    ? `Analyze this transcript exactly as provided: ${transcript}`
    : 'Listen to this audio.';

  return `You must respond with ONLY a valid JSON object. No markdown, no code blocks, no explanation text, no trailing commas, no comments. Start your response with { and end with }.

You are a professional child psychologist and parenting coach.
${transcriptInstruction} The speaker is using ${language}.

STRICT OUTPUT RULES - FOLLOW EXACTLY:
1. Return ONLY one short raw JSON object.
2. Keep every string brief to avoid truncation.
3. detectedIssues must contain maximum 3 short strings.
4. suggestions must contain maximum 3 short strings.
5. positiveNotes must contain maximum 2 short strings.
6. Only values for transcript, detectedIssues, suggestions, impactAnalysis, positiveNotes should be written in ${language}.

Output exactly this and nothing else:
{
  "transcript": "string (max 300 chars)",
  "tone": "string (one word)",
  "confidence": 80,
  "emotionalIntensity": "low|medium|high",
  "parentingStyle": "string (one word)",
  "detectedIssues": ["max 3 short strings"],
  "suggestions": ["max 3 short strings"],
  "impactAnalysis": "string (max 100 chars)",
  "positiveNotes": ["max 2 short strings"],
  "language": "${language}"
}`;
}

function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from Gemini');
  }

  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e1) {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.substring(start, end + 1));
    } catch (e2) {}
  }

  try {
    const fixed = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
  } catch (e3) {}

  try {
    let fixed = cleaned;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;

    if ((fixed.match(/"/g) || []).length % 2 !== 0) {
      fixed += '"';
    }
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      fixed += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      fixed += '}';
    }
    return JSON.parse(fixed);
  } catch (e4) {}

  console.error('All JSON parse attempts failed. Raw text:', text.substring(0, 500));
  throw new Error('Invalid JSON from Gemini after all recovery attempts');
}

function extractSafeJson(result) {
  const rawText = result.response.text().trim();
  console.log('RAW GEMINI RESPONSE:', rawText.substring(0, 600));
  console.log('Gemini raw response:', rawText.substring(0, 300));

  const jsonStr = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = extractJSON(jsonStr);
  const emotionalIntensityValue = parsed.emotional_intensity ?? parsed.emotionalIntensity;
  const emotionalIntensityNumber = typeof emotionalIntensityValue === 'number'
    ? emotionalIntensityValue
    : emotionalIntensityValue === 'high'
    ? 80
    : emotionalIntensityValue === 'medium'
    ? 50
    : 25;
  const parentingStyleValue = parsed.parenting_style ?? parsed.parentingStyle;

  return {
    transcript: parsed.transcript || '',
    tone: ['calm', 'supportive', 'firm', 'harsh', 'aggressive'].includes(parsed.tone) ? parsed.tone : 'calm',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 75,
    emotional_intensity: emotionalIntensityNumber,
    parenting_style: ['authoritative', 'authoritarian', 'permissive', 'uninvolved'].includes(parentingStyleValue) ? parentingStyleValue : 'authoritative',
    detected_issues: Array.isArray(parsed.detected_issues) ? parsed.detected_issues : Array.isArray(parsed.detectedIssues) ? parsed.detectedIssues : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    impact_analysis: parsed.impact_analysis || parsed.impactAnalysis || '',
    positive_notes: Array.isArray(parsed.positive_notes) ? parsed.positive_notes : Array.isArray(parsed.positiveNotes) ? parsed.positiveNotes : [],
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
