import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { collection, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase-config';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';
import { getScoreColor, reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';

type FirestoreReport = {
  id: string;
  score: number;
  date: Date;
  strengths: string[];
  improvements: string[];
  transcript?: string;
  childId?: string | null;
  childName?: string | null;
};

type ChildFilter = {
  id: string;
  name: string;
};

type BadgeState = {
  id: string;
  icon: string;
  name: string;
  earned: boolean;
  earnedAt?: Date | null;
  requirement: string;
};

const badgeDefinitions = (reports: FirestoreReport[]): BadgeState[] => {
  const uniqueDays = new Set(reports.map((report) => report.date.toISOString().slice(0, 10)));
  return [
    {
      id: 'first_steps',
      icon: '🎉',
      name: 'First Steps',
      earned: reports.length >= 1,
      requirement: 'Complete 1 session to unlock',
    },
    {
      id: 'on_a_roll',
      icon: '🔥',
      name: 'On a Roll',
      earned: reports.length >= 3,
      requirement: 'Complete 3 sessions to unlock',
    },
    {
      id: 'committed_parent',
      icon: '🏆',
      name: 'Committed Parent',
      earned: reports.length >= 10,
      requirement: 'Complete 10 sessions to unlock',
    },
    {
      id: 'high_scorer',
      icon: '⭐',
      name: 'High Scorer',
      earned: reports.some((report) => report.score > 80),
      requirement: 'Score above 80 to unlock',
    },
    {
      id: 'consistent',
      icon: '📅',
      name: 'Consistent',
      earned: uniqueDays.size >= 3,
      requirement: 'Complete sessions on 3 different days',
    },
    {
      id: 'excellence',
      icon: '🌟',
      name: 'Excellence',
      earned: reports.some((report) => report.score > 90),
      requirement: 'Score above 90 to unlock',
    },
  ];
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
  const days = new Set(reports.map((report) => report.date.toISOString().slice(0, 10)));
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
          stroke={getScoreColor(score)}
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
        <Text style={[styles.ringScore, { color: getScoreColor(score) }]}>{score}%</Text>
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
        <Polyline
          points={`${padding},${padding} ${padding},${height - padding} ${width - padding},${height - padding}`}
          fill="none"
          stroke="#E5E5E5"
          strokeWidth={2}
        />
        <Polyline
          points={points.join(' ')}
          fill="none"
          stroke="#000"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chartReports.map((report, index) => {
          const [x, y] = points[index].split(',').map(Number);
          return <Circle key={report.id} cx={x} cy={y} r={5} fill={getScoreColor(report.score)} />;
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

function SkeletonInsights() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View>
      {[0, 1, 2, 3].map((item) => (
        <Animated.View key={item} style={[styles.skeletonCard, { opacity: pulse }]} />
      ))}
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

function AchievementsSection({ badges }: { badges: BadgeState[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBubble}>
          <FontAwesome name="certificate" size={18} color="#000" />
        </View>
        <Text style={styles.sectionTitle}>Achievements</Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
            <Text style={styles.badgeIcon}>{badge.earned ? badge.icon : '🔒'}</Text>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDate}>
              {badge.earned && badge.earnedAt
                ? `Earned on: ${badge.earnedAt.toLocaleDateString()}`
                : badge.requirement}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [reports, setReports] = useState<FirestoreReport[]>([]);
  const [children, setChildren] = useState<ChildFilter[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('all');
  const [badges, setBadges] = useState<BadgeState[]>(badgeDefinitions([]));
  const [loading, setLoading] = useState(true);

  const updateBadges = useCallback(async (userId: string, sourceReports: FirestoreReport[]) => {
    const definitions = badgeDefinitions(sourceReports);
    const existingSnapshot = await getDocs(collection(db, 'users', userId, 'badges'));
    const existing = new Map(
      existingSnapshot.docs.map((item) => [item.id, item.data().earnedAt?.toDate?.() || new Date()])
    );

    await Promise.all(
      definitions
        .filter((badge) => badge.earned && !existing.has(badge.id))
        .map((badge) =>
          setDoc(doc(db, 'users', userId, 'badges', badge.id), {
            name: badge.name,
            icon: badge.icon,
            earnedAt: new Date(),
          })
        )
    );

    setBadges(
      definitions.map((badge) => ({
        ...badge,
        earnedAt: existing.get(badge.id) || (badge.earned ? new Date() : null),
      }))
    );
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) {
        console.log('Fetched reports:', 0);
        setReports([]);
        setBadges(badgeDefinitions([]));
        return;
      }

      const reportSnapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'))
      );
      const childSnapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'children'), orderBy('createdAt', 'desc'))
      );

      const nextReports = reportSnapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          score: reportScoreFromData(data),
          date: toReportDate(data.date ?? data.createdAt),
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
          childId: data.childId || null,
          childName: data.childName || null,
        };
      });
      const nextChildren = childSnapshot.docs.map((item) => ({
        id: item.id,
        name: String(item.data().name || 'Child'),
      }));

      console.log('Fetched reports:', nextReports.length);
      setReports(nextReports);
      setChildren(nextChildren);
      await updateBadges(user.uid, nextReports);
    } catch (error) {
      console.error('Failed to load insights:', error);
      setReports([]);
      setBadges(badgeDefinitions([]));
    } finally {
      setLoading(false);
    }
  }, [updateBadges]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const visibleReports = useMemo(() => {
    if (selectedChildId === 'all') return reports;
    return reports.filter((report) => report.childId === selectedChildId);
  }, [reports, selectedChildId]);

  const summary = useMemo(() => {
    const totalSessions = visibleReports.length;
    const averageScore = totalSessions
      ? Math.round(visibleReports.reduce((sum, report) => sum + report.score, 0) / totalSessions)
      : 0;
    const strengths = visibleReports.flatMap((report) => report.strengths);
    const improvements = visibleReports.flatMap((report) => report.improvements);
    const chronologicalReports = visibleReports.slice().reverse();
    const lastSession = visibleReports[0] || null;

    return {
      totalSessions,
      averageScore,
      topStrength: topItem(strengths),
      topImprovement: topItem(improvements),
      streak: calculateStreak(visibleReports),
      lastSession,
      chronologicalReports,
    };
  }, [visibleReports]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>{t('insights_overview')}</Text>
      <Text style={styles.pageSubtitle}>Real progress from your saved coaching reports</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childFilters}>
        <TouchableOpacity
          style={[styles.childFilter, selectedChildId === 'all' && styles.childFilterActive]}
          onPress={() => setSelectedChildId('all')}
        >
          <Text style={selectedChildId === 'all' ? styles.childFilterTextActive : styles.childFilterText}>
            All children
          </Text>
        </TouchableOpacity>
        {children.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[styles.childFilter, selectedChildId === child.id && styles.childFilterActive]}
            onPress={() => setSelectedChildId(child.id)}
          >
            <Text style={selectedChildId === child.id ? styles.childFilterTextActive : styles.childFilterText}>
              {child.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <>
          <Text style={styles.placeholderText}>Loading your insights...</Text>
          <SkeletonInsights />
        </>
      ) : visibleReports.length === 0 ? (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.placeholderText}>
              Complete at least one coaching session to unlock your personalized insights
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/record' as any)}>
              <Text style={styles.emptyButtonText}>Start a Session</Text>
            </TouchableOpacity>
          </View>
          <AchievementsSection badges={badges} />
        </>
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

          <InsightCard icon="star" title="Top Strength" value={summary.topStrength} subtitle="Most frequent positive behavior" />
          <InsightCard icon="wrench" title="Top Area To Improve" value={summary.topImprovement} subtitle="Most frequent flagged improvement" />
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
              <Text style={[styles.cardValue, { color: getScoreColor(summary.lastSession.score) }]}>
                {summary.lastSession.score}%
              </Text>
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
                onPress={() =>
                  router.push({
                    pathname: '/(drawer)/report-detail' as any,
                    params: { id: summary.lastSession?.id },
                  })
                }
              >
                <Text style={styles.reportButtonText}>View Full Report</Text>
              </TouchableOpacity>
            </View>
          )}

          <AchievementsSection badges={badges} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.background, flex: 1 },
  content: {
    gap: 16,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  pageTitle: { ...Typography.h1, color: Colors.text },
  pageSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: -8,
  },
  childFilters: { marginBottom: 2 },
  childFilter: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  childFilterActive: { backgroundColor: '#000', borderColor: '#000' },
  childFilterText: { color: '#000', fontSize: 13, fontWeight: '700' },
  childFilterTextActive: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  topGrid: { gap: 16 },
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
  cardValue: { color: '#000', fontSize: 30, fontWeight: '900', lineHeight: 38 },
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
  ringCenter: { alignItems: 'center', position: 'absolute' },
  ringScore: { fontSize: 32, fontWeight: '900' },
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
  chartLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  reportButton: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: BorderRadius.md,
    marginTop: 16,
    paddingVertical: 12,
  },
  reportButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  skeletonCard: {
    backgroundColor: '#E5E5E5',
    borderRadius: 16,
    height: 130,
    marginBottom: 16,
  },
  badgeGrid: { gap: 10 },
  badgeCard: { backgroundColor: '#F7F7F7', borderRadius: 12, padding: 14 },
  badgeCardLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 26 },
  badgeName: { color: '#000', fontSize: 15, fontWeight: '900', marginTop: 6 },
  badgeDate: { color: '#777', fontSize: 12, fontWeight: '600', marginTop: 3 },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...Typography.h3, color: Colors.text },
  emptyButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  placeholderText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});
