import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Svg, { Circle } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { historyService } from '../../src/services/history-service';
import { calculateParentingScore, type CoachingReport, type ParentingAnalysis } from '../../src/types/analysis';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const localeForLanguage = (language: string) =>
  language === 'ar' ? 'ar-SA' : language === 'tr' ? 'tr-TR' : 'en-US';

const formatDate = (isoDate: string, language: string) =>
  new Date(isoDate).toLocaleDateString(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
  });

function scoreForAnalysis(analysis: ParentingAnalysis | undefined): number {
  if (!analysis) return 0;
  return Math.min(
    100,
    Math.round(
      (analysis.positive_notes?.length > 0 ? 30 : 0) +
        (analysis.tone === 'calm' || analysis.tone === 'supportive'
          ? 30
          : analysis.tone === 'firm'
          ? 20
          : analysis.tone === 'harsh'
          ? 5
          : 0) +
        Math.max(0, 30 - ((analysis.detected_issues?.length || 0) * 10)) +
        (analysis.emotional_intensity <= 40
          ? 10
          : analysis.emotional_intensity <= 70
          ? 5
          : 0)
    )
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 170;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <View style={styles.ringWrapper}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E5E5"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#000"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progress}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringScore}>{score}</Text>
        <Text style={styles.ringOutOf}>/ 100</Text>
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<CoachingReport[]>([]);
  const [issuesExpanded, setIssuesExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      historyService.getHistory().then(setHistory);
    }, [])
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(localeForLanguage(i18n.language), {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [i18n.language]
  );

  const scoreLabel = useCallback(
    (score: number) => {
      if (score >= 80) return t('insights_score_excellent');
      if (score >= 60) return t('insights_score_good');
      if (score >= 40) return t('insights_score_improve');
      return t('insights_score_attention');
    },
    [t]
  );

  const summary = useMemo(() => {
    const scores = history.map((report) => calculateParentingScore(report.analysis));
    const averageScore = scores.length
      ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
      : 0;
    const latestScore = scores[0] ?? 0;
    const previousScore = scores[1] ?? latestScore;
    const trend = latestScore > previousScore ? '↑' : latestScore < previousScore ? '↓' : '→';
    const averageIntensity = history.length
      ? Math.round(
          history.reduce((total, item) => total + item.analysis.emotional_intensity, 0) /
            history.length
        )
      : 0;
    const toneCounts = history.reduce<Record<string, number>>((acc, item) => {
      acc[item.analysis.tone] = (acc[item.analysis.tone] || 0) + 1;
      return acc;
    }, {});
    const mostCommonTone =
      Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

    return {
      averageScore,
      latestScore,
      trend,
      averageIntensity,
      mostCommonTone,
    };
  }, [history]);

  const sessions = useMemo(() => history.slice().reverse(), [history]);

  const chartData = useMemo(() => {
    return sessions.slice(-7).map((session) => {
      const label = formatDate(session.createdAt, i18n.language);
      return {
        name: label,
        positive: session.analysis?.positive_notes?.length || 0,
        negative: session.analysis?.detected_issues?.length || 0,
        score: scoreForAnalysis(session.analysis),
      };
    });
  }, [sessions, i18n.language]);

  const issues = useMemo(
    () =>
      history.flatMap((session, sessionIndex) =>
        session.analysis.detected_issues.map((issue) => ({
          id: `${session.id}-${issue}`,
          issue,
          sessionLabel: `${t('history_session')} ${sessionIndex + 1} · ${formatDate(
            session.createdAt,
            i18n.language
          )}`,
        }))
      ),
    [history, i18n.language, t]
  );

  const toggleIssues = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIssuesExpanded((value) => !value);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t('insights_overview')}</Text>
      <Text style={styles.dateText}>{todayLabel}</Text>

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="bar-chart" size={46} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('insights_title')}</Text>
          <Text style={styles.emptyText}>{t('insights_no_data')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('insights_avg_score')}</Text>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <View style={styles.scoreColumn}>
                <ScoreRing score={summary.averageScore} />
                <Text style={styles.scoreCaption}>{scoreLabel(summary.averageScore)}</Text>
              </View>
              <View style={styles.sessionStats}>
                <Text style={styles.mainValue}>{history.length}</Text>
                <Text style={styles.statLabel}>{t('insights_sessions')}</Text>
                <Text style={styles.trendText}>{summary.trend}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('insights_interaction_trend')}</Text>
            <View style={styles.divider} />
            <Text style={styles.chartTitle}>{t('insights_chart_title')}</Text>
            {chartData.length < 2 ? (
              <Text style={styles.chartPlaceholder}>{t('insights_no_data')}</Text>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E5E5', fontSize: 13 }}
                    formatter={(value, name) => [
                      value,
                      name === 'positive' ? t('insights_positive') : t('insights_negative'),
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'positive' ? t('insights_positive') : t('insights_negative')
                    }
                  />
                  <Bar dataKey="positive" fill="#000000" radius={[4, 4, 0, 0]} name="positive" />
                  <Bar dataKey="negative" fill="#D0D0D0" radius={[4, 4, 0, 0]} name="negative" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartData.length >= 2 && (
              <View style={styles.scoreTrend}>
                <Text style={styles.chartTitle}>{t('insights_score_trend')}</Text>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #E5E5E5', fontSize: 13 }}
                      formatter={(value) => [`${value}/100`, 'Score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#000000"
                      strokeWidth={2}
                      fill="#F0F0F0"
                      dot={{ fill: '#000', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#000' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('insights_tone_pattern')}</Text>
            <View style={styles.divider} />
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('insights_common_tone')}</Text>
              <Text style={styles.metricValue}>{summary.mostCommonTone}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>{t('insights_avg_intensity')}</Text>
              <Text style={styles.metricValue}>{summary.averageIntensity}%</Text>
            </View>
            <View style={styles.segmentLabels}>
              <Text style={styles.segmentLabel}>0%</Text>
              <Text style={styles.segmentLabel}>50%</Text>
              <Text style={styles.segmentLabel}>100%</Text>
            </View>
            <View style={styles.segmentedTrack}>
              <View
                style={[
                  styles.segmentedFill,
                  { width: `${Math.min(summary.averageIntensity, 100)}%` },
                ]}
              />
              <View style={[styles.segmentDivider, { left: '50%' }]} />
            </View>
          </View>

          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={toggleIssues}>
            <View style={styles.issueHeader}>
              <Text style={styles.sectionTitle}>{t('insights_issues_title')}</Text>
              <View style={styles.issueHeaderRight}>
                <View style={styles.issueBadge}>
                  <Text style={styles.issueBadgeText}>
                    {issues.length} {t('insights_issues_found')}
                  </Text>
                </View>
                <Text style={styles.chevron}>{issuesExpanded ? '▲' : '▼'}</Text>
              </View>
            </View>
            <View style={styles.divider} />

            {issues.length === 0 ? (
              <Text style={styles.placeholderText}>{t('insights_no_issues')}</Text>
            ) : issuesExpanded ? (
              <ScrollView style={styles.issueList} nestedScrollEnabled>
                {issues.map((item) => (
                  <View key={item.id} style={styles.issueItem}>
                    <Text style={styles.warningIcon}>⚠</Text>
                    <View style={styles.issueTextGroup}>
                      <Text style={styles.issueText}>{item.issue}</Text>
                      <Text style={styles.issueMeta}>{item.sessionLabel}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              issues.slice(0, 3).map((item) => (
                <Text key={item.id} style={styles.issuePreview}>
                  {item.issue}
                </Text>
              ))
            )}
          </TouchableOpacity>
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
    gap: 16,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  pageTitle: {
    ...Typography.h1,
    color: Colors.text,
  },
  dateText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: -10,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.border,
    borderLeftColor: '#000',
    borderLeftWidth: 3,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  divider: {
    backgroundColor: Colors.border,
    height: 1,
    marginBottom: 18,
    marginTop: 14,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  scoreColumn: {
    alignItems: 'center',
    flex: 1,
  },
  ringWrapper: {
    alignItems: 'center',
    height: 170,
    justifyContent: 'center',
    width: 170,
  },
  ringCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  ringScore: {
    color: '#000',
    fontSize: 44,
    fontWeight: '900',
  },
  ringOutOf: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreCaption: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  sessionStats: {
    alignItems: 'flex-start',
    borderColor: Colors.border,
    borderLeftWidth: 1,
    flex: 0.72,
    paddingLeft: 18,
  },
  mainValue: {
    color: '#000',
    fontSize: 36,
    fontWeight: '800',
  },
  statLabel: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  trendText: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '900',
    marginTop: 16,
  },
  chartTitle: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '800',
    marginBottom: 12,
  },
  chartPlaceholder: {
    color: '#AAA',
    padding: 40,
    textAlign: 'center',
  },
  scoreTrend: {
    marginTop: 24,
  },
  placeholderText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  metricLabel: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  metricValue: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  segmentLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  segmentLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  segmentedTrack: {
    backgroundColor: '#E6E6E6',
    borderRadius: BorderRadius.round,
    height: 14,
    marginTop: 8,
    overflow: 'hidden',
  },
  segmentedFill: {
    backgroundColor: '#000',
    height: '100%',
  },
  segmentDivider: {
    backgroundColor: '#FFF',
    height: '100%',
    position: 'absolute',
    width: 2,
  },
  issueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  issueHeaderRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  issueBadge: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  issueBadgeText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '800',
  },
  chevron: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  issuePreview: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 8,
  },
  issueList: {
    maxHeight: 260,
  },
  issueItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  warningIcon: {
    fontSize: 16,
    lineHeight: 22,
  },
  issueTextGroup: {
    flex: 1,
  },
  issueText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '700',
    lineHeight: 20,
  },
  issueMeta: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 3,
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
    textAlign: 'center',
  },
});
