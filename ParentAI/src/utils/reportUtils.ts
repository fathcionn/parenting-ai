import { COLORS } from '../theme/colors';

export const getScoreColor = (score: number) => {
  if (score >= 80) return COLORS.success;
  if (score >= 50) return COLORS.warning;
  return COLORS.error;
};

export const SESSION_TAGS = [
  { id: 'bedtime', label: 'Bedtime routine', icon: '😴', color: COLORS.warningBg },
  { id: 'homework', label: 'Homework help', icon: '📚', color: COLORS.successBg },
  { id: 'tantrum', label: 'Tantrum management', icon: '😤', color: COLORS.errorBg },
  { id: 'screen_time', label: 'Screen time limits', icon: '📱', color: COLORS.surfaceContainerHigh },
  { id: 'mealtime', label: 'Mealtime behavior', icon: '🍽️', color: COLORS.warningBg },
  { id: 'siblings', label: 'Sibling conflicts', icon: '🤝', color: COLORS.surfaceContainer },
  { id: 'general', label: 'General coaching', icon: '✨', color: COLORS.surfaceContainer },
] as const;

export type SessionTagId = (typeof SESSION_TAGS)[number]['id'];

export function getSessionTag(tagId?: string | null) {
  return SESSION_TAGS.find((tag) => tag.id === tagId) || SESSION_TAGS[6];
}

export function toReportDate(value: any): Date {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

export function reportScoreFromData(data: any): number {
  const raw = data?.score ?? data?.parentingScore ?? 0;
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
