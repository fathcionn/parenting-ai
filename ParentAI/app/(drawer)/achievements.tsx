import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase-config';
import { reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';
import { useTranslation } from 'react-i18next';

type Report = {
  id: string;
  date: Date;
  score: number;
};

type Badge = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  earnedLabel: string;
  progress: number;
};

const earnedBadgeStyles: Record<
  string,
  { backgroundColor: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }
> = {
  'first-step': { backgroundColor: '#6366F1', icon: 'celebration' },
  'three-day-streak': { backgroundColor: '#B55D00', icon: 'local-fire-department' },
  'calm-voice': { backgroundColor: '#4648D4', icon: 'star' },
  'role-model': { backgroundColor: '#4648D4', icon: 'workspace-premium' },
};

const lockedIcons: React.ComponentProps<typeof MaterialIcons>['name'][] = [
  'event-available',
  'calendar-month',
  'workspace-premium',
];

const badgeTitleKeys: Record<string, string> = {
  'first-step': 'achievement_first_step_title',
  'three-day-streak': 'achievement_three_day_streak_title',
  'calm-voice': 'achievement_calm_voice_title',
  'role-model': 'achievement_role_model_title',
  'active-listener': 'achievement_active_listener_title',
  'zen-master': 'achievement_zen_master_title',
  'consistent-routine': 'achievement_consistent_routine_title',
  'expert-parent': 'achievement_expert_parent_title',
};

const badgeEarnedKeys: Record<string, string> = {
  'first-step': 'achievement_first_step_earned',
  'three-day-streak': 'achievement_three_day_streak_earned',
  'calm-voice': 'achievement_calm_voice_earned',
  'role-model': 'achievement_role_model_earned',
  'active-listener': 'achievement_active_listener_earned',
  'zen-master': 'achievement_zen_master_earned',
  'consistent-routine': 'achievement_consistent_routine_earned',
  'expert-parent': 'achievement_expert_parent_earned',
};

const badgeUnlockKeys: Record<string, string> = {
  'first-step': 'achievement_first_step_unlock',
  'three-day-streak': 'achievement_three_day_streak_unlock',
  'calm-voice': 'achievement_calm_voice_unlock',
  'role-model': 'achievement_role_model_unlock',
  'active-listener': 'achievement_active_listener_unlock',
  'zen-master': 'achievement_zen_master_unlock',
  'consistent-routine': 'achievement_consistent_routine_unlock',
  'expert-parent': 'achievement_expert_parent_unlock',
};

function getUnlockCondition(badge: Badge) {
  if (badge.id === 'first-step') return 'Unlock at 1 session';
  if (badge.id === 'three-day-streak') return 'Unlock at 3 active days';
  if (badge.id === 'calm-voice') return 'Unlock at 80+ score';
  if (badge.id === 'role-model') return 'Unlock at 90+ score';
  if (badge.id === 'active-listener') return 'Unlock at 10 sessions';
  if (badge.id === 'consistent-routine') return 'Unlock at 5 active days';
  if (badge.id === 'expert-parent') return 'Unlock at 12 sessions';
  return `Unlock at ${badge.description}`;
}

function buildBadges(reports: Report[]): Badge[] {
  const uniqueDays = new Set(reports.map((report) => report.date.toISOString().slice(0, 10)));
  const highScore = reports.some((report) => report.score >= 80);
  const excellentScore = reports.some((report) => report.score >= 90);

  return [
    {
      id: 'first-step',
      emoji: '\u{1F389}',
      title: 'First Step',
      description: 'Completed your very first coaching session.',
      earned: reports.length >= 1,
      earnedLabel: 'Earned after first session',
      progress: Math.min(100, reports.length * 100),
    },
    {
      id: 'three-day-streak',
      emoji: '\u{1F525}',
      title: '3-Day Streak',
      description: 'Maintained active coaching across 3 different days.',
      earned: uniqueDays.size >= 3,
      earnedLabel: 'Earned after 3 days',
      progress: Math.min(100, Math.round((uniqueDays.size / 3) * 100)),
    },
    {
      id: 'calm-voice',
      emoji: '\u2B50',
      title: 'Calm Voice',
      description: 'Scored above 80 in a coaching session.',
      earned: highScore,
      earnedLabel: 'Earned with high score',
      progress: highScore ? 100 : 60,
    },
    {
      id: 'role-model',
      emoji: '\u{1F3C6}',
      title: 'Role Model',
      description: 'Achieved 90%+ positive communication score.',
      earned: excellentScore,
      earnedLabel: 'Earned with excellence',
      progress: excellentScore ? 100 : 80,
    },
    {
      id: 'active-listener',
      emoji: '\u{1F5E3}\uFE0F',
      title: 'Active Listener',
      description: 'Complete 10 coaching sessions.',
      earned: reports.length >= 10,
      earnedLabel: 'Earned after 10 sessions',
      progress: Math.min(100, Math.round((reports.length / 10) * 100)),
    },
    {
      id: 'zen-master',
      emoji: '\u{1F9D8}',
      title: 'Zen Master',
      description: 'Keep practicing calm communication routines.',
      earned: reports.length >= 7 && highScore,
      earnedLabel: 'Earned through consistency',
      progress: reports.length >= 7 ? 50 : 15,
    },
    {
      id: 'consistent-routine',
      emoji: '\u{1F4C5}',
      title: 'Consistent Routine',
      description: 'Complete sessions on 5 different days.',
      earned: uniqueDays.size >= 5,
      earnedLabel: 'Earned after 5 days',
      progress: Math.min(100, Math.round((uniqueDays.size / 5) * 100)),
    },
    {
      id: 'expert-parent',
      emoji: '\u{1F393}',
      title: 'Expert Parent',
      description: 'Complete all baseline coaching milestones.',
      earned: reports.length >= 12 && excellentScore,
      earnedLabel: 'Earned at mastery',
      progress: Math.min(80, Math.round((reports.length / 12) * 80)),
    },
  ];
}

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const user = auth.currentUser;
    if (!user) {
      setReports([]);
      setLoading(false);
      return;
    }

    try {
      const snapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'))
      );
      setReports(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            date: toReportDate(data.date || data.createdAt),
            score: reportScoreFromData(data),
          };
        })
      );
    } catch (error) {
      console.error('Failed to load achievements:', error);
      setReports([]);
      setLoadError('achievements_load_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const badges = useMemo(() => buildBadges(reports), [reports]);
  const earnedCount = badges.filter((badge) => badge.earned).length;
  const completePercent = Math.round((earnedCount / badges.length) * 100);
  const visibleBadges = badges.filter((badge) => {
    if (filter === 'earned') return badge.earned;
    if (filter === 'locked') return !badge.earned;
    return true;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('achievements_title')}</Text>
        <Text style={styles.subtitle}>{t('achievements_subtitle')}</Text>
      </View>

      {loading ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>{t('achievements_loading')}</Text>
        </View>
      ) : loadError ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>{t('achievements_unavailable')}</Text>
          <Text style={styles.badgeDescription}>{t(loadError)}</Text>
          <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]} onPress={loadReports}>
            <Text style={styles.filterTextActive}>{t('achievements_retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.labelCaps}>{t('achievements_current_status')}</Text>
            <Text style={styles.progressTitle}>
              {t('achievements_earned_count', { earned: earnedCount, total: badges.length })}
            </Text>
          </View>
          <Text style={styles.progressCaption}>{t('achievements_complete', { percent: completePercent })}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completePercent}%` }]} />
        </View>
      </View>

      <View style={styles.badgeHeader}>
        <Text style={styles.sectionTitle}>{t('achievements_your_badges')}</Text>
        <View style={styles.filterRow}>
          {(['all', 'earned', 'locked'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={filter === item ? styles.filterTextActive : styles.filterText}>
                {t(`achievements_filter_${item}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {visibleBadges.map((badge) => (
          <TouchableOpacity key={badge.id} activeOpacity={0.82} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
            {badge.earned ? (
              <View
                style={[
                  styles.badgeIconCircle,
                  { backgroundColor: earnedBadgeStyles[badge.id]?.backgroundColor || '#6366F1' },
                ]}
              >
                <MaterialIcons
                  name={earnedBadgeStyles[badge.id]?.icon || 'emoji-events'}
                  size={40}
                  color="#FFFFFF"
                />
              </View>
            ) : (
              <View style={styles.lockedIconOuter}>
                <MaterialIcons
                  name={lockedIcons[visibleBadges.indexOf(badge) % lockedIcons.length]}
                  size={40}
                  color="#767586"
                />
                <View style={styles.lockOverlay}>
                  <MaterialIcons name="lock" size={13} color="#464554" />
                </View>
              </View>
            )}
            <Text style={[styles.badgeTitle, !badge.earned && styles.badgeTitleLocked]}>{t(badgeTitleKeys[badge.id] || badge.title)}</Text>
            <Text style={[styles.badgeMeta, !badge.earned && styles.badgeMetaLocked]}>
              {badge.earned ? t(badgeEarnedKeys[badge.id] || badge.earnedLabel) : t(badgeUnlockKeys[badge.id] || getUnlockCondition(badge))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF8FF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 64,
    gap: 22,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    color: '#1B1B23',
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: '#464554',
    fontSize: 16,
    lineHeight: 24,
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)',
      } as any,
    }),
  },
  progressHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  labelCaps: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: '#1B1B23',
    fontSize: 18,
    fontWeight: '900',
  },
  progressCaption: {
    color: '#767586',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    backgroundColor: '#E4E1ED',
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#6366F1',
    borderRadius: 999,
    height: 10,
  },
  badgeHeader: {
    gap: 14,
  },
  sectionTitle: {
    color: '#1B1B23',
    fontSize: 20,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterText: {
    color: '#464554',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  badgeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 210,
    padding: 20,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)',
      } as any,
    }),
  },
  badgeCardLocked: {
    opacity: 0.9,
  },
  badgeIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4E1ED',
    position: 'relative',
  },
  lockOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4E1ED',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  badgeTitle: {
    color: '#1B1B23',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  badgeTitleLocked: {
    color: '#464554',
  },
  badgeMeta: {
    color: '#4648D4',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginTop: 5,
    textAlign: 'center',
  },
  badgeMetaLocked: {
    color: '#767586',
  },
  badgeDescription: {
    color: '#464554',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
