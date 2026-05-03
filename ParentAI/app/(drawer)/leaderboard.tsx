import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Switch } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../src/constants/theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from 'react-i18next';

// Mock data for the leaderboard
const MOCK_LEADERBOARD = [
  { id: '1', displayName: 'CalmParent88', score: 98, rank: 1, trend: 'up' },
  { id: '2', displayName: 'Anonymous', score: 95, rank: 2, trend: 'flat' },
  { id: '3', displayName: 'ZenMother', score: 92, rank: 3, trend: 'up' },
  { id: '4', displayName: 'Anonymous', score: 89, rank: 4, trend: 'down' },
  { id: '5', displayName: 'You', score: 85, rank: 5, trend: 'up' },
  { id: '6', displayName: 'HappyDad', score: 84, rank: 6, trend: 'down' },
];

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const [isOptedIn, setIsOptedIn] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('leaderboard_title')}</Text>

      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View>
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
            <View>
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
        <FlatList
          data={MOCK_LEADERBOARD}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.rankCard, item.displayName === 'You' && styles.rankCardHighlight]}>
              <Text style={styles.rankNumber}>#{item.rank}</Text>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName}>
                  {item.displayName === 'You'
                    ? t('leaderboard_you')
                    : item.displayName === 'Anonymous'
                    ? t('leaderboard_anonymous_parent')
                    : item.displayName}
                </Text>
                <Text style={styles.rankScore}>{item.score} {t('leaderboard_points')}</Text>
              </View>
              <FontAwesome
                name={item.trend === 'up' ? 'caret-up' : item.trend === 'down' ? 'caret-down' : 'minus'}
                size={18}
                color={item.trend === 'up' ? Colors.success : item.trend === 'down' ? Colors.error : Colors.textMuted}
              />
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <FontAwesome name="trophy" size={48} color={Colors.border} />
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
    paddingBottom: Spacing.xxl,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxl * 2,
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
