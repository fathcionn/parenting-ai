import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/theme';
import { COLORS } from '../../src/theme/colors';
import { historyService } from '../../src/services/history-service';
import { calculateParentingScore } from '../../src/types/analysis';

type LeaderboardItem = {
  rank: number;
  name: string;
  score: number;
  isMe?: boolean;
};

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const [isOptedIn, setIsOptedIn] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [myScore, setMyScore] = useState(0);

  useEffect(() => {
    const loadScore = async () => {
      const history = await historyService.getHistory();
      if (history.length === 0) {
        setMyScore(0);
        return;
      }

      const scores = history.map((report) => calculateParentingScore(report.analysis));
      const average = Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
      setMyScore(average);
    };

    loadScore();
  }, []);

  const localLeaderboard: LeaderboardItem[] = myScore > 0 ? [
    {
      rank: 1,
      name: 'You',
      score: myScore,
      isMe: true,
    },
  ] : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Benchmarks</Text>
      <Text style={styles.subtitle}>Anonymous averages from the TalkWise community</Text>

      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingTextGroup}>
            <Text style={styles.settingLabel}>{t('leaderboard_participate')}</Text>
            <Text style={styles.settingSubLabel}>{t('leaderboard_compare')}</Text>
          </View>
          <Switch
            value={isOptedIn}
            onValueChange={setIsOptedIn}
            trackColor={{ false: Colors.border, true: Colors.primary }}
          />
        </View>

        {isOptedIn && (
          <View style={[styles.settingRow, styles.settingRowBorder]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>{t('profile_stay_anonymous')}</Text>
              <Text style={styles.settingSubLabel}>{t('leaderboard_hide_name')}</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
        )}
      </View>

      {isOptedIn ? (
        <>
          <FlatList
            data={localLeaderboard}
            keyExtractor={(item) => String(item.rank)}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <View style={[styles.rankCard, item.isMe && styles.rankCardHighlight]}>
                <Text style={styles.rankNumber}>#{item.rank}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{item.name}</Text>
                  <Text style={styles.rankScore}>
                    {item.score} {t('leaderboard_points')}
                  </Text>
                </View>
              </View>
            )}
          />
          <Text style={styles.localNote}>{t('leaderboard_local_note')}</Text>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>{t('leaderboard_disabled')}</Text>
          <Text style={styles.emptyText}>{t('leaderboard_empty')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  settingsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  settingTextGroup: {
    flex: 1,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
  },
  settingLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  settingSubLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listContainer: {
    paddingBottom: Spacing.md,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankCardHighlight: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  rankNumber: {
    ...Typography.h3,
    color: Colors.textMuted,
    width: 40,
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.text,
  },
  rankScore: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  localNote: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxl * 2,
  },
  emptyIcon: {
    color: Colors.border,
    fontSize: 48,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: '80%',
  },
});
