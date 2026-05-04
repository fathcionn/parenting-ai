import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { historyService } from '../../src/services/history-service';
import type { CoachingReport } from '../../src/types/analysis';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [history, setHistory] = useState<CoachingReport[]>([]);
  const [query, setQuery] = useState('');

  const loadHistory = useCallback(async () => {
    const records = await historyService.getHistory();
    setHistory(records);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return history;

    return history.filter((item) => {
      const date = new Date(item.createdAt).toLocaleDateString().toLowerCase();
      return (
        item.analysis.tone.toLowerCase().includes(normalizedQuery) ||
        item.transcript.toLowerCase().includes(normalizedQuery) ||
        date.includes(normalizedQuery)
      );
    });
  }, [history, query]);

  const deleteRecord = (record: CoachingReport) => {
    Alert.alert(t('history_delete'), t('history_delete'), [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('common_delete'),
        style: 'destructive',
        onPress: async () => {
          await historyService.deleteReport(record.id);
          await loadHistory();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('history_title')}</Text>

      <View style={styles.searchBar}>
        <FontAwesome name="search" size={14} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('history_search')}
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {filteredHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="microphone-slash" size={42} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('history_empty')}</Text>
          <Text style={styles.emptyText}>
            {t('home_session_saved')}
          </Text>
        </View>
      ) : (
        filteredHistory.map((record) => {
          return (
            <View key={record.id}>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => router.push(`/history/${record.id}`)}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.dateText}>{formatDate(record.createdAt)}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.toneBadge}>
                      <Text style={styles.toneBadgeText}>{record.analysis.tone}</Text>
                    </View>
                    <Text style={styles.duration}>
                      {t('coaching_intensity')} {record.analysis.emotional_intensity}%
                    </Text>
                  </View>
                </View>

                <View style={styles.scoreArea}>
                  <Text style={styles.score}>{record.parentingScore}</Text>
                  <Text style={styles.scoreLabel}>{t('profile_parenting_score')}</Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    deleteRecord(record);
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="trash-o" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    ...Typography.bodySmall,
    color: Colors.text,
    flex: 1,
    paddingVertical: 12,
  },
  card: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  cardMain: {
    flex: 1,
    gap: 8,
  },
  dateText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '700',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toneBadge: {
    backgroundColor: Colors.primaryFaded,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toneBadgeText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  duration: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  scoreArea: {
    alignItems: 'center',
    minWidth: 52,
  },
  score: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  scoreLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  deleteButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});
