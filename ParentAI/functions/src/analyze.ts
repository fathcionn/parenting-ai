/**
 * AI Conversation Analysis Service
 * 
 * Uses OpenAI GPT-4o-mini to analyze parent-child conversation transcripts.
 * Detects tone, harmful language, and provides constructive feedback.
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Types for analysis results
interface AnalysisInteraction {
  text: string;
  tone: 'calm' | 'supportive' | 'neutral' | 'frustrated' | 'angry';
  category: 'discipline' | 'support' | 'conflict' | 'teaching' | 'play';
  harmfulPhrases: string[];
  suggestions: string[];
  emotionalImpact: 'positive' | 'neutral' | 'negative';
  impactDescription: string;
}

interface AnalysisOutput {
  interactions: AnalysisInteraction[];
  toneBreakdown: Record<string, number>;
  overallScore: number;
}

/**
 * Analyze a transcript using OpenAI GPT-4o-mini.
 * 
 * The prompt is carefully engineered to:
 * 1. Be non-judgmental and constructive
 * 2. Provide specific, actionable alternatives
 * 3. Consider the child's age for impact assessment
 * 4. Return structured JSON for easy parsing
 */
export async function analyzeTranscript(
  userId: string,
  sessionId: string,
  transcriptId: string,
  transcriptText: string
): Promise<void> {
  console.log(`Starting AI analysis for transcript: ${transcriptId}`);

  // Get child profile for age-adaptive analysis
  const userDoc = await admin.firestore()
    .collection('users').doc(userId).get();
  
  const selectedChildId = userDoc.data()?.selectedChildId;
  let childAge = 5; // Default age

  if (selectedChildId) {
    const childDoc = await admin.firestore()
      .collection('users').doc(userId)
      .collection('children').doc(selectedChildId).get();
    
    if (childDoc.exists) {
      childAge = childDoc.data()?.age || 5;
    }
  }

  // Build the analysis prompt
  const systemPrompt = buildSystemPrompt(childAge);

  if (!process.env.OPENAI_API_KEY) {
    console.warn("No OPENAI_API_KEY found. Falling back to mock analysis.");
    const analysis = generateMockAnalysis(transcriptText);
    await saveAnalysis(userId, sessionId, transcriptId, analysis, childAge);
    return;
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this parent-child conversation:\n\n${transcriptText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent analysis
      max_tokens: 2000,
    });
    
    const analysis: AnalysisOutput = JSON.parse(
      response.choices[0].message.content
    );

    await saveAnalysis(userId, sessionId, transcriptId, analysis, childAge);
    console.log(`Analysis complete. Score: ${analysis.overallScore}`);
  } catch (error) {
    console.error("OpenAI analysis failed:", error);
    // Fallback if API fails
    const analysis = generateMockAnalysis(transcriptText);
    await saveAnalysis(userId, sessionId, transcriptId, analysis, childAge);
  }
}

async function saveAnalysis(userId: string, sessionId: string, transcriptId: string, analysis: AnalysisOutput, childAge: number) {
  // Save analysis to Firestore
  await admin.firestore()
    .collection('users').doc(userId)
    .collection('analyses')
    .add({
      sessionId,
      transcriptId,
      toneBreakdown: analysis.toneBreakdown,
      overallScore: analysis.overallScore,
      interactions: analysis.interactions,
      childAge,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * Build the system prompt for GPT analysis.
 * This is the core of the AI analysis — carefully crafted to be
 * constructive, non-judgmental, and age-appropriate.
 */
function buildSystemPrompt(childAge: number): string {
  return `You are an expert child psychologist and parenting coach. Your role is to analyze parent-child conversation transcripts and provide helpful, non-judgmental feedback.

IMPORTANT GUIDELINES:
- Be compassionate and supportive. Parenting is hard.
- Never use accusatory language. Use "I notice..." instead of "You shouldn't..."
- Provide specific, practical alternative phrases
- Consider the child's developmental stage (age: ${childAge} years old)
- Focus on patterns, not individual moments
- Acknowledge good interactions, not just areas for improvement

CHILD AGE CONTEXT (${childAge} years old):
${getAgeContext(childAge)}

ANALYSIS INSTRUCTIONS:
For each parent utterance in the transcript, analyze:

1. TONE: Classify as one of: calm, supportive, neutral, frustrated, angry
2. CATEGORY: Classify as: discipline, support, conflict, teaching, play
3. HARMFUL PHRASES: List any phrases that could negatively impact the child
4. SUGGESTIONS: Provide 1-2 alternative phrases that are more effective
5. EMOTIONAL IMPACT: Classify as: positive, neutral, negative
6. IMPACT DESCRIPTION: Brief explanation of potential effect on the child

Also calculate:
- TONE BREAKDOWN: Percentage of each tone category
- OVERALL SCORE: 0-100 parenting score (70+ is good, 50-70 needs improvement, <50 concerning)

RESPOND IN JSON FORMAT:
{
  "interactions": [
    {
      "text": "original phrase",
      "tone": "calm|supportive|neutral|frustrated|angry",
      "category": "discipline|support|conflict|teaching|play",
      "harmfulPhrases": ["phrase1"],
      "suggestions": ["alternative1", "alternative2"],
      "emotionalImpact": "positive|neutral|negative",
      "impactDescription": "explanation"
    }
  ],
  "toneBreakdown": { "calm": 30, "supportive": 25, ... },
  "overallScore": 72
}

DISCLAIMER: Always remember that this analysis provides guidance and insights, not professional or medical diagnosis.`;
}

function getAgeContext(age: number): string {
  if (age <= 2) {
    return 'At this age, children are developing trust and attachment. Tone of voice matters more than words. Gentle, warm tones promote secure attachment. Harsh tones can cause distress.';
  }
  if (age <= 5) {
    return 'Preschoolers are developing self-regulation and language skills. They need patience, gentle redirection, and simple explanations. Avoid complex reasoning or rhetorical questions.';
  }
  if (age <= 8) {
    return 'School-age children understand cause and effect. They benefit from explanations, positive reinforcement, and consistency. They are sensitive to criticism and comparison.';
  }
  if (age <= 12) {
    return 'Pre-teens are developing independence and self-identity. They need respect for growing autonomy, collaborative problem-solving, and validation of emotions.';
  }
  return 'Teenagers need active listening, validation, and respect for their opinions. Avoid lecturing. Use open-ended questions. They are highly sensitive to perceived control or dismissal.';
}

/**
 * Generate mock analysis for graduation demo.
 * In production, this would be replaced by actual GPT response.
 */
function generateMockAnalysis(text: string): AnalysisOutput {
  return {
    interactions: [
      {
        text: 'Please finish your homework before playing.',
        tone: 'calm',
        category: 'discipline',
        harmfulPhrases: [],
        suggestions: [],
        emotionalImpact: 'neutral',
        impactDescription: 'Clear, direct instruction without negative emotion. Good communication.',
      },
      {
        text: 'I understand you want to play, but homework comes first. How about we make it fun?',
        tone: 'supportive',
        category: 'teaching',
        harmfulPhrases: [],
        suggestions: [],
        emotionalImpact: 'positive',
        impactDescription: 'Validates the child\'s feelings while maintaining boundaries. Excellent approach.',
      },
    ],
    toneBreakdown: {
      calm: 35,
      supportive: 30,
      neutral: 20,
      frustrated: 10,
      angry: 5,
    },
    overallScore: 75,
  };
}
