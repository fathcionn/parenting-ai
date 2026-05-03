import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AnalysisDisplay } from '../../src/components/AnalysisDisplay';
import { Card } from '../../src/components/Layout';
import { historyService } from '../../src/services/history-service';
import type { CoachingReport } from '../../src/types/analysis';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';

const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function ReportDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<CoachingReport | null>(null);

  useEffect(() => {
    if (!id) return;
    historyService.getReport(id).then(setReport);
  }, [id]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <FontAwesome name="chevron-left" size={14} color={Colors.text} />
        <Text style={styles.backText}>{t('history_title')}</Text>
      </TouchableOpacity>

      {!report ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('history_empty')}</Text>
        </View>
      ) : (
        <>
          <Card>
            <Text style={styles.title}>{t('history_view_report')}</Text>
            <Text style={styles.meta}>{formatDate(report.createdAt)}</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreBadge}>
                <Text style={styles.score}>{report.parentingScore}</Text>
                <Text style={styles.scoreLabel}>{t('profile_parenting_score')}</Text>
              </View>
              <View style={styles.summary}>
                <Text style={styles.summaryText}>{t('coaching_tone')}: {report.analysis.tone}</Text>
                <Text style={styles.summaryText}>{t('coaching_confidence')}: {report.analysis.confidence}%</Text>
                <Text style={styles.summaryText}>{report.durationSeconds}s</Text>
              </View>
            </View>
          </Card>

          <AnalysisDisplay analysis={report} />
        </>
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
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  backText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '700',
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
  },
  meta: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  scoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.lg,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.round,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  score: {
    color: Colors.textOnPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  scoreLabel: {
    ...Typography.caption,
    color: Colors.textOnPrimary,
  },
  summary: {
    flex: 1,
    gap: 6,
  },
  summaryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
});
