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

  return `You are a professional child psychologist and parenting coach.
${transcriptInstruction} The speaker is using ${language}.

STRICT OUTPUT RULES - FOLLOW EXACTLY:
1. Return ONLY a raw JSON object. No markdown. No code blocks. No explanation.
2. JSON property KEYS must always be exactly these English words: transcript, tone, confidence, emotional_intensity, parenting_style, detected_issues, suggestions, impact_analysis, positive_notes
3. Only the VALUES of: transcript, detected_issues, suggestions, impact_analysis, positive_notes should be written in ${language}
4. The VALUES of tone must be one of: calm, supportive, firm, harsh, aggressive
5. The VALUES of parenting_style must be one of: authoritative, authoritarian, permissive, uninvolved
6. confidence and emotional_intensity must be numbers between 0 and 100

Output exactly this and nothing else:
{"transcript":"...","tone":"calm","confidence":80,"emotional_intensity":30,"parenting_style":"authoritative","detected_issues":["..."],"suggestions":["..."],"impact_analysis":"...","positive_notes":["..."]}`;
}

function extractSafeJson(result) {
  const rawText = result.response.text().trim();
  console.log('Gemini raw response:', rawText.substring(0, 300));

  let jsonStr = rawText;
  jsonStr = jsonStr
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in Gemini response: ' + rawText.substring(0, 200));
  }
  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

  const parsed = JSON.parse(jsonStr);

  return {
    transcript: parsed.transcript || '',
    tone: ['calm', 'supportive', 'firm', 'harsh', 'aggressive'].includes(parsed.tone) ? parsed.tone : 'calm',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 75,
    emotional_intensity: typeof parsed.emotional_intensity === 'number' ? parsed.emotional_intensity : 30,
    parenting_style: ['authoritative', 'authoritarian', 'permissive', 'uninvolved'].includes(parsed.parenting_style) ? parsed.parenting_style : 'authoritative',
    detected_issues: Array.isArray(parsed.detected_issues) ? parsed.detected_issues : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    impact_analysis: parsed.impact_analysis || '',
    positive_notes: Array.isArray(parsed.positive_notes) ? parsed.positive_notes : [],
  };
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { transcript, language } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const languageNames = { en: 'English', ar: 'Arabic', tr: 'Turkish' };
    const langName = languageNames[language] || 'English';

    const prompt = buildStrictJsonPrompt(langName, transcript);

    const result = await model.generateContent(prompt);
    res.json(extractSafeJson(result));
  } catch (err) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType, language } = req.body;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = buildStrictJsonPrompt(language);

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64,
        },
      },
    ]);

    res.json(extractSafeJson(result));
  } catch (err) {
    console.error('Gemini audio error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Proxy running on http://localhost:3001'));
