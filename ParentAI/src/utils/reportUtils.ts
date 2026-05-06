export const getScoreColor = (score: number) => {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

export const SESSION_TAGS = [
  { id: 'bedtime', label: 'Bedtime routine', icon: '😴', color: '#DBEAFE' },
  { id: 'homework', label: 'Homework help', icon: '📚', color: '#DCFCE7' },
  { id: 'tantrum', label: 'Tantrum management', icon: '😤', color: '#FEE2E2' },
  { id: 'screen_time', label: 'Screen time limits', icon: '📱', color: '#EDE9FE' },
  { id: 'mealtime', label: 'Mealtime behavior', icon: '🍽️', color: '#FEF3C7' },
  { id: 'siblings', label: 'Sibling conflicts', icon: '🤝', color: '#E0F2FE' },
  { id: 'general', label: 'General coaching', icon: '✨', color: '#F3F4F6' },
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
