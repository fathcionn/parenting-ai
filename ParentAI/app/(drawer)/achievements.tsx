import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase-config';
import { reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';
import { COLORS } from '../../src/theme/colors';

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
      setLoadError('Could not load achievements. Please try again.');
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
      <Text style={styles.title}>Achievements</Text>
      <Text style={styles.subtitle}>
        Track your personal growth as a parent. These badges celebrate your coaching milestones.
      </Text>

      {loading ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Loading achievements...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Achievements unavailable</Text>
          <Text style={styles.badgeDescription}>{loadError}</Text>
          <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]} onPress={loadReports}>
            <Text style={styles.filterTextActive}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.labelCaps}>Current Status</Text>
            <Text style={styles.progressTitle}>
              {earnedCount} of {badges.length} earned
            </Text>
          </View>
          <Text style={styles.progressCaption}>{completePercent}% Complete</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completePercent}%` }]} />
        </View>
      </View>

      <View style={styles.badgeHeader}>
        <Text style={styles.sectionTitle}>Your Badges</Text>
        <View style={styles.filterRow}>
          {(['all', 'earned', 'locked'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={filter === item ? styles.filterTextActive : styles.filterText}>
                {item[0].toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {visibleBadges.map((badge) => (
          <TouchableOpacity
            key={badge.id}
            activeOpacity={0.82}
            style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}
          >
            {!badge.earned ? <Text style={styles.lockIcon}>{'\u{1F512}'}</Text> : null}
            <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>{badge.emoji}</Text>
            <Text style={styles.badgeTitle}>{badge.title}</Text>
            <Text style={styles.badgeDescription}>{badge.description}</Text>
            {badge.earned ? (
              <View style={styles.earnedFooter}>
                <Text style={styles.earnedText}>{badge.earnedLabel}</Text>
              </View>
            ) : (
              <View style={styles.lockedFooter}>
                <View style={styles.smallTrack}>
                  <View style={[styles.smallFill, { width: `${badge.progress}%` }]} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 24,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  title: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 54,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginBottom: 24,
    marginTop: -12,
  },
  progressCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  progressHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  labelCaps: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
  },
  progressCaption: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 6,
    height: 12,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    height: 12,
  },
  badgeHeader: {
    gap: 16,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  filterChipActive: {
    backgroundColor: COLORS.surfaceContainer,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  filterTextActive: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  badgeCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.primary,
    borderRadius: 16,
    borderWidth: 2,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 250,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },
  badgeCardLocked: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    opacity: 0.5,
  },
  lockIcon: {
    color: COLORS.textSecondary,
    fontSize: 16,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  badgeEmoji: {
    fontSize: 48,
    lineHeight: 56,
    marginBottom: 14,
  },
  badgeEmojiLocked: {
    opacity: 0.45,
  },
  badgeTitle: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeDescription: {
    color: COLORS.textSecondary,
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  earnedFooter: {
    borderTopColor: COLORS.cardBorder,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
    width: '100%',
  },
  earnedText: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  lockedFooter: {
    borderTopColor: COLORS.cardBorder,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 14,
    width: '100%',
  },
  smallTrack: {
    backgroundColor: COLORS.progressTrack,
    borderRadius: 9999,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  smallFill: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 9999,
    height: 6,
  },
});
