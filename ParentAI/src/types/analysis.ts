export type ParentingTone = 'calm' | 'supportive' | 'firm' | 'harsh' | 'aggressive';

export type ParentingStyle =
  | 'authoritative'
  | 'authoritarian'
  | 'permissive'
  | 'uninvolved';

export interface ParentingAnalysis {
  tone: ParentingTone;
  confidence: number;
  emotional_intensity: number;
  parenting_style: ParentingStyle;
  detected_issues: string[];
  suggestions: string[];
  impact_analysis: string;
  positive_notes: string[];
}

export interface CoachingReport {
  id: string;
  createdAt: string;
  durationSeconds: number;
  audioUri: string | null;
  transcript: string;
  language?: string;
  mode?: 'background' | 'coaching';
  analysis: ParentingAnalysis;
  parentingScore: number;
  childId?: string | null;
  childName?: string | null;
  tag?: string | null;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  tips?: string[];
  safetyFlag?: {
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    detected: string[];
    recommendation: string;
  } | null;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateParentingScore(analysis: ParentingAnalysis): number {
  const positiveNotes = analysis.positive_notes || [];
  const detectedIssues = analysis.detected_issues || [];
  const emotionalIntensity = clampPercent(analysis.emotional_intensity);
  const tone = analysis.tone;

  const score = Math.round(
    (positiveNotes.length > 0 ? 30 : 0) +
      (tone === 'calm' || tone === 'supportive'
        ? 30
        : tone === 'firm'
        ? 20
        : tone === 'harsh'
        ? 5
        : 0) +
      Math.max(0, 30 - detectedIssues.length * 10) +
      (emotionalIntensity <= 40 ? 10 : emotionalIntensity <= 70 ? 5 : 0)
  );

  return clampPercent(score);
}
