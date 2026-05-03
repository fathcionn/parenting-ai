// Shared TypeScript types for ParentAI

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  settings: UserSettings;
  parentingScore: number; // 0-100
  isAnonymous: boolean;
}

export interface UserSettings {
  recordingMode: 'manual' | 'auto' | 'continuous';
  coachingEnabled: boolean;
  coachingSensitivity: number; // 0-1
  dailyReportEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  audioRetentionHours: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  avatarEmoji: string;
  notes: string;
  createdAt: Date;
}

export interface RecordingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  status: 'recording' | 'paused' | 'uploading' | 'transcribing' | 'analyzing' | 'complete' | 'error';
  childId?: string;
  recordingMode: 'manual' | 'auto' | 'continuous';
}

export interface Transcript {
  id: string;
  sessionId: string;
  text: string;
  segments: TranscriptSegment[];
  createdAt: Date;
}

export interface TranscriptSegment {
  text: string;
  speaker: 'parent' | 'child' | 'unknown';
  startTime: number;
  endTime: number;
  confidence: number;
}

export type ToneCategory = 'calm' | 'supportive' | 'neutral' | 'frustrated' | 'angry';
export type InteractionType = 'discipline' | 'support' | 'conflict' | 'teaching' | 'play';

export interface AnalysisResult {
  id: string;
  sessionId: string;
  transcriptId: string;
  toneBreakdown: Record<ToneCategory, number>; // percentages
  overallScore: number; // 0-100
  interactions: Interaction[];
  createdAt: Date;
}

export interface Interaction {
  id: string;
  text: string;
  tone: ToneCategory;
  category: InteractionType;
  harmfulPhrases: string[];
  suggestions: string[];
  emotionalImpact: 'positive' | 'neutral' | 'negative';
  impactDescription: string;
  timestamp: number;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  toneDistribution: Record<ToneCategory, number>;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalInteractions: number;
  overallScore: number;
  topSuggestions: string[];
  comparedToPrevious: number; // percentage change in score
  createdAt: Date;
}

export interface CoachingAlert {
  id: string;
  timestamp: Date;
  volumeLevel: number;
  message: string;
  dismissed: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  trend: 'up' | 'down' | 'flat';
}
