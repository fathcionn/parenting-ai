import { COLORS } from '../theme/colors';

export const getScoreColor = (score: number) => {
  if (score >= 80) return COLORS.success;
  if (score >= 50) return COLORS.warning;
  return COLORS.error;
};

export const SESSION_TAGS = [
  { id: 'bedtime', labelKey: 'tag_bedtime', label: 'Bedtime routine', icon: 'Zz', color: COLORS.warningBg },
  { id: 'homework', labelKey: 'tag_homework', label: 'Homework help', icon: 'Hw', color: COLORS.successBg },
  { id: 'tantrum', labelKey: 'tag_tantrum', label: 'Tantrum management', icon: '!', color: COLORS.errorBg },
  { id: 'screen_time', labelKey: 'tag_screen_time', label: 'Screen time limits', icon: 'Tv', color: COLORS.surfaceContainerHigh },
  { id: 'mealtime', labelKey: 'tag_mealtime', label: 'Mealtime behavior', icon: 'Ml', color: COLORS.warningBg },
  { id: 'siblings', labelKey: 'tag_siblings', label: 'Sibling conflicts', icon: 'Sb', color: COLORS.surfaceContainer },
  { id: 'background', labelKey: 'tag_background', label: 'Background coaching', icon: 'Bg', color: COLORS.surfaceContainerHigh },
  { id: 'general', labelKey: 'tag_general', label: 'General coaching', icon: '*', color: COLORS.surfaceContainer },
] as const;

export type SessionTagId = (typeof SESSION_TAGS)[number]['id'];

export function getSessionTag(tagId?: string | null) {
  return SESSION_TAGS.find((tag) => tag.id === tagId) || SESSION_TAGS[7];
}

export function getSessionTagLabel(tagId: string | null | undefined, t: (key: string) => string) {
  const tag = getSessionTag(tagId);
  return t(tag.labelKey) || tag.label;
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
