import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase-config';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';

type FirestoreReport = {
  id: string;
  score: number;
  date: Date;
  strengths: string[];
  improvements: string[];
  transcript?: string;
};

const clampScore = (value: unknown) => {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(numberValue)));
};

const toDate = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') return new Date(value);
  if (value instanceof Date) return value;
  return new Date();
};

const topItem = (items: string[]) => {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const key = item.trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No data yet';
};

const calculateStreak = (reports: FirestoreReport[]) => {
  const days = new Set(
    reports.map((report) => report.date.toISOString().slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

function ScoreRing({ score }: { score: number }) {
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <View style={styles.ringWrapper}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E7E7E7"
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
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringScore}>{score}%</Text>
        <Text style={styles.ringLabel}>Average</Text>
      </View>
    </View>
  );
}

function ProgressLine({ reports }: { reports: FirestoreReport[] }) {
  const width = 310;
  const height = 160;
  const padding = 24;
  const chartReports = reports.slice(-7);
  const points = chartReports.map((report, index) => {
    const x =
      chartReports.length === 1
        ? width / 2
        : padding + (index * (width - padding * 2)) / (chartReports.length - 1);
    const y = padding + ((100 - report.score) * (height - padding * 2)) / 100;
    return `${x},${y}`;
  });

  if (chartReports.length < 2) {
    return <Text style={styles.placeholderText}>Complete more sessions to see progress.</Text>;
  }

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline points={`${padding},${padding} ${padding},${height - padding} ${width - padding},${height - padding}`} fill="none" stroke="#E5E5E5" strokeWidth={2} />
        <Polyline points={points.join(' ')} fill="none" stroke="#000" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {chartReports.map((report, index) => {
          const [x, y] = points[index].split(',').map(Number);
          return <Circle key={report.id} cx={x} cy={y} r={5} fill="#000" />;
        })}
      </Svg>
      <View style={styles.chartLabels}>
        {chartReports.map((report) => (
          <Text key={report.id} style={styles.chartLabel}>
            {report.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        ))}
      </View>
    </View>
  );
}

function InsightCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBubble}>
          <FontAwesome name={icon} size={18} color="#000" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [reports, setReports] = useState<FirestoreReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) {
        console.log('Fetched reports:', 0);
        setReports([]);
        return;
      }

      const snapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'))
      );
      const nextReports = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          score: clampScore(data.score ?? data.parentingScore),
          date: toDate(data.date ?? data.createdAt),
          strengths: Array.isArray(data.strengths)
            ? data.strengths
            : Array.isArray(data.analysis?.positive_notes)
            ? data.analysis.positive_notes
            : [],
          improvements: Array.isArray(data.improvements)
            ? data.improvements
            : Array.isArray(data.analysis?.detected_issues)
            ? data.analysis.detected_issues
            : [],
          transcript: String(data.transcript || ''),
        };
      });
      console.log('Fetched reports:', nextReports.length);
      setReports(nextReports);
    } catch (error) {
      console.error('Failed to load insights:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const summary = useMemo(() => {
    const totalSessions = reports.length;
    const averageScore = totalSessions
      ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / totalSessions)
      : 0;
    const strengths = reports.flatMap((report) => report.strengths);
    const improvements = reports.flatMap((report) => report.improvements);
    const chronologicalReports = reports.slice().reverse();
    const lastSession = reports[0] || null;

    return {
      totalSessions,
      averageScore,
      topStrength: topItem(strengths),
      topImprovement: topItem(improvements),
      streak: calculateStreak(reports),
      lastSession,
      chronologicalReports,
    };
  }, [reports]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t('insights_overview')}</Text>
      <Text style={styles.pageSubtitle}>Real progress from your saved coaching reports</Text>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color="#000" size="large" />
          <Text style={styles.placeholderText}>Loading your insights...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="bar-chart" size={46} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('insights_title')}</Text>
          <Text style={styles.placeholderText}>Complete a session to unlock insights.</Text>
        </View>
      ) : (
        <>
          <View style={styles.topGrid}>
            <InsightCard
              icon="check-circle"
              title="Total Sessions"
              value={String(summary.totalSessions)}
              subtitle="Completed coaching sessions"
            />
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBubble}>
                  <FontAwesome name="percent" size={16} color="#000" />
                </View>
                <Text style={styles.sectionTitle}>Average Score</Text>
              </View>
              <ScoreRing score={summary.averageScore} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBubble}>
                <FontAwesome name="line-chart" size={18} color="#000" />
              </View>
              <Text style={styles.sectionTitle}>Progress Over Time</Text>
            </View>
            <ProgressLine reports={summary.chronologicalReports} />
          </View>

          <InsightCard
            icon="star"
            title="Top Strength"
            value={summary.topStrength}
            subtitle="Most frequent positive behavior"
          />

          <InsightCard
            icon="wrench"
            title="Top Area To Improve"
            value={summary.topImprovement}
            subtitle="Most frequent flagged improvement"
          />

          <InsightCard
            icon="fire"
            title="Streak"
            value={`${summary.streak} day${summary.streak === 1 ? '' : 's'}`}
            subtitle="Days in a row with at least one session"
          />

          {summary.lastSession && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconBubble}>
                  <FontAwesome name="file-text-o" size={18} color="#000" />
                </View>
                <Text style={styles.sectionTitle}>Last Session Summary</Text>
              </View>
              <Text style={styles.cardValue}>{summary.lastSession.score}%</Text>
              <Text style={styles.cardSubtitle}>
                {summary.lastSession.date.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={styles.reportButton}
                activeOpacity={0.8}
                onPress={() => router.push(`/history/${summary.lastSession?.id}`)}
              >
                <Text style={styles.reportButtonText}>View Full Report</Text>
              </TouchableOpacity>
            </View>
          )}
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
  pageSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: -8,
  },
  topGrid: {
    gap: 16,
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionTitle: {
    color: '#888',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  cardValue: {
    color: '#000',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
  },
  cardSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    marginTop: 6,
  },
  ringWrapper: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 150,
    justifyContent: 'center',
    width: 150,
  },
  ringCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  ringScore: {
    color: '#000',
    fontSize: 32,
    fontWeight: '900',
  },
  ringLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  chartLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  reportButton: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: BorderRadius.md,
    marginTop: 16,
    paddingVertical: 12,
  },
  reportButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.xxl * 2,
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
  placeholderText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});
