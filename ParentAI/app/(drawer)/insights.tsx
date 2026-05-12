import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { db } from '../../src/config/firebase-config';
import { reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';

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
      icon: '??',
      name: 'First Steps',
      earned: reports.length >= 1,
      requirement: 'Complete 1 session to unlock',
    },
    {
      id: 'on_a_roll',
      icon: '??',
      name: 'On a Roll',
      earned: reports.length >= 3,
      requirement: 'Complete 3 sessions to unlock',
    },
    {
      id: 'committed_parent',
      icon: '??',
      name: 'Committed Parent',
      earned: reports.length >= 10,
      requirement: 'Complete 10 sessions to unlock',
    },
    {
      id: 'high_scorer',
      icon: '?',
      name: 'High Scorer',
      earned: reports.some((report) => report.score > 80),
      requirement: 'Score above 80 to unlock',
    },
    {
      id: 'consistent',
      icon: '??',
      name: 'Consistent',
      earned: uniqueDays.size >= 3,
      requirement: 'Complete sessions on 3 different days',
    },
    {
      id: 'excellence',
      icon: '??',
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
  const size = 184;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - safeScore / 100);

  return (
    <View style={styles.ringWrapper}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E4E1ED"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#6366F1"
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
        <Text style={styles.ringScore}>{safeScore}</Text>
        <Text style={styles.ringLabel}>/ 100</Text>
      </View>
    </View>
  );
}

function ProgressLine({ reports }: { reports: FirestoreReport[] }) {
  const chartReports = reports.slice(-7);

  if (chartReports.length === 0) {
    return <Text style={styles.placeholderText}>Complete more sessions to see progress.</Text>;
  }

  return (
    <View style={styles.barChart}>
      {chartReports.map((report, index) => {
        const height = Math.max(18, Math.min(132, (report.score / 100) * 132));
        const isLatest = index === chartReports.length - 1;
        return (
          <View key={report.id} style={styles.barColumn}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  isLatest && styles.barFillLatest,
                  { height },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>
              {report.date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1)}
            </Text>
          </View>
        );
      })}
      {Array.from({ length: Math.max(0, 7 - chartReports.length) }).map((_, index) => (
        <View key={`empty-${index}`} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: 18, opacity: 0.35 }]} />
          </View>
          <Text style={styles.chartLabel}>-</Text>
        </View>
      ))}
    </View>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SkeletonInsights() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: false }),
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
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBubble}>
          <MaterialIcons name={icon} size={18} color="#6366F1" />
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
          <MaterialIcons name="emoji-events" size={18} color="#6366F1" />
        </View>
        <Text style={styles.sectionTitle}>Achievements</Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
            <Text style={styles.badgeIcon}>{badge.earned ? badge.icon : '??'}</Text>
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
  const router = useRouter();
  const [reports, setReports] = useState<FirestoreReport[]>([]);
  const [children, setChildren] = useState<ChildFilter[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | '3m'>('week');
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

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      console.log('Fetched reports:', 0);
      setReports([]);
      setChildren([]);
      setBadges(badgeDefinitions([]));
      setLoading(false);
      return;
    }

    const reportsQuery = query(collection(db, 'users', user.uid, 'reports'), orderBy('createdAt', 'desc'));
    const childrenQuery = query(collection(db, 'users', user.uid, 'children'), orderBy('createdAt', 'desc'));

    const unsubscribeReports = onSnapshot(
      reportsQuery,
      (reportSnapshot) => {
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

        console.log('Fetched reports:', nextReports.length);
        setReports(nextReports);
        setLoading(false);
        updateBadges(user.uid, nextReports).catch((error) => {
          console.warn('Failed to update badges in background:', error);
        });
      },
      (error) => {
        console.error('Failed to load insights:', error);
        setReports([]);
        setBadges(badgeDefinitions([]));
        setLoading(false);
      }
    );

    const unsubscribeChildren = onSnapshot(
      childrenQuery,
      (childSnapshot) => {
        const nextChildren = childSnapshot.docs.map((item) => ({
          id: item.id,
          name: String(item.data().name || 'Child'),
        }));
        setChildren(nextChildren);
      },
      (error) => {
        console.error('Failed to load insight children:', error);
        setChildren([]);
      }
    );

    return () => {
      unsubscribeReports();
      unsubscribeChildren();
    };
  }, [updateBadges]);

  const visibleReports = useMemo(() => {
    const now = Date.now();
    const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 90;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const periodReports = reports.filter((report) => report.date.getTime() >= cutoff);
    if (selectedChildId === 'all') return periodReports;
    return periodReports.filter((report) => report.childId === selectedChildId);
  }, [reports, selectedChildId, selectedPeriod]);

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
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Your Parenting Overview</Text>
        <Text style={styles.pageSubtitle}>Insights and progress for this week.</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.childFilters}
        contentContainerStyle={styles.childFiltersContent}
      >
        <TouchableOpacity
          style={[styles.childFilter, selectedChildId === 'all' && styles.childFilterActive]}
          onPress={() => setSelectedChildId('all')}
        >
          <Text style={selectedChildId === 'all' ? styles.childFilterTextActive : styles.childFilterText}>
            All
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

      <View style={styles.periodTabs}>
        {[
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
          { id: '3m', label: '3M' },
        ].map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[styles.periodTab, selectedPeriod === period.id && styles.periodTabActive]}
            onPress={() => setSelectedPeriod(period.id as 'week' | 'month' | '3m')}
            activeOpacity={0.8}
          >
            <Text style={selectedPeriod === period.id ? styles.periodTabTextActive : styles.periodTabText}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <>
          <Text style={styles.placeholderText}>Loading your insights...</Text>
          <SkeletonInsights />
        </>
      ) : visibleReports.length === 0 ? (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>??</Text>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.placeholderText}>
              Complete at least one coaching session to unlock your personalized insights
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/coaching' as any)}>
              <Text style={styles.emptyButtonText}>Start a Session</Text>
            </TouchableOpacity>
          </View>
          <AchievementsSection badges={badges} />
        </>
      ) : (
        <>
          <View style={styles.averageCard}>
            <Text style={styles.averageTitle}>Average Score</Text>
            <ScoreRing score={summary.averageScore} />
            <Text style={styles.averageFooter}>Consistent positive engagement this week.</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              icon="event-note"
              iconBg="#F0EEFF"
              iconColor="#6366F1"
              value={String(summary.totalSessions)}
              label="Sessions"
            />
            <StatCard
              icon="speed"
              iconBg="#EEF2FF"
              iconColor="#4F46E5"
              value={String(summary.averageScore)}
              label="Avg Score"
            />
            <StatCard
              icon="local-fire-department"
              iconBg="#FFF3E8"
              iconColor="#EA580C"
              value={`${summary.streak}🔥`}
              label="Streak Days"
            />
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Score Over Last 7 Sessions</Text>
            <ProgressLine reports={summary.chronologicalReports} />
          </View>

          <View style={styles.coachSection}>
            <Text style={styles.sectionHeading}>Coach Insights</Text>
            <View style={[styles.coachCard, styles.strengthCard]}>
              <View style={styles.coachIconWrap}>
                <MaterialIcons name="check-circle" size={24} color="#6366F1" />
              </View>
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachCardTitle}>Top Strength</Text>
                <Text style={styles.coachCardText}>
                  {summary.topStrength === 'No data yet'
                    ? 'Using calm voice tone during transitions.'
                    : summary.topStrength}
                </Text>
              </View>
            </View>
            <View style={[styles.coachCard, styles.improvementCard]}>
              <View style={styles.coachIconWrap}>
                <MaterialIcons name="build" size={24} color="#D97706" />
              </View>
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachCardTitle}>Top Improvement</Text>
                <Text style={styles.coachCardText}>
                  {summary.topImprovement === 'No data yet'
                    ? 'Reduce repetitive commands and pause for response.'
                    : summary.topImprovement}
                </Text>
              </View>
            </View>
          </View>

          {summary.lastSession && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionHeading}>Recent</Text>
              <View style={styles.recentCard}>
                <View style={styles.recentIcon}>
                  <MaterialIcons name="description" size={24} color="#6366F1" />
                </View>
                <View style={styles.recentCopy}>
                  <Text style={styles.recentTitle}>
                    Last Session: {summary.lastSession.childName || 'Bedtime Negotiation'}
                  </Text>
                  <Text style={styles.recentTime}>
                    {summary.lastSession.date.toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {summary.lastSession.score}/100
                  </Text>
                </View>
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
                  <Text style={styles.reportButtonText}>View Report</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
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
    paddingTop: 24,
    paddingBottom: 48,
    gap: 20,
  },
  header: {
    marginBottom: 2,
  },
  pageTitle: {
    color: '#1B1B23',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: '#464554',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  childFilters: {
    flexGrow: 0,
    marginBottom: 2,
  },
  childFiltersContent: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E1ED',
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  childFilter: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: 'transparent',
  },
  childFilterActive: {
    backgroundColor: '#6366F1',
  },
  childFilterText: {
    color: '#464554',
    fontSize: 14,
    fontWeight: '700',
  },
  childFilterTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
  },
  periodTab: {
    borderColor: '#E4E1ED',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  periodTabActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  periodTabText: {
    color: '#464554',
    fontSize: 13,
    fontWeight: '800',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  averageCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 26,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 24px 60px rgba(49, 46, 129, 0.14)',
      } as any,
    }),
  },
  averageTitle: {
    alignSelf: 'flex-start',
    color: '#1B1B23',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
  },
  averageFooter: {
    color: '#464554',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    textAlign: 'center',
  },
  ringWrapper: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 184,
    justifyContent: 'center',
    width: 184,
  },
  ringCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  ringScore: {
    color: '#6366F1',
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  ringLabel: {
    color: '#767586',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 104,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0EEF8',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: '0px 12px 24px rgba(49, 46, 129, 0.08)',
      } as any,
    }),
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    color: '#1B1B23',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
  },
  statLabel: {
    color: '#767586',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0EEF8',
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
  chartTitle: {
    color: '#1B1B23',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 18,
  },
  barChart: {
    height: 170,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 9,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    height: 132,
    width: '100%',
    maxWidth: 28,
    justifyContent: 'flex-end',
    backgroundColor: '#F5F2FE',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#C0C1FF',
    borderRadius: 999,
  },
  barFillLatest: {
    backgroundColor: '#6366F1',
  },
  chartLabel: {
    color: '#767586',
    fontSize: 11,
    fontWeight: '800',
  },
  coachSection: {
    gap: 12,
  },
  sectionHeading: {
    color: '#1B1B23',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 5,
  },
  strengthCard: {
    backgroundColor: '#F5F2FE',
    borderLeftColor: '#6366F1',
  },
  improvementCard: {
    backgroundColor: '#FFF7ED',
    borderLeftColor: '#D97706',
  },
  coachIconWrap: {
    marginTop: 2,
  },
  coachTextWrap: {
    flex: 1,
  },
  coachCardTitle: {
    color: '#1B1B23',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  coachCardText: {
    color: '#464554',
    fontSize: 14,
    lineHeight: 21,
  },
  recentSection: {
    gap: 12,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0EEF8',
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
  recentIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0EEFF',
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: '#1B1B23',
    fontSize: 15,
    fontWeight: '900',
  },
  recentTime: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  reportButton: {
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  reportButtonText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F0EEF8',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: '#F0EEFF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionTitle: {
    color: '#767586',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardValue: {
    color: '#1B1B23',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  cardSubtitle: {
    color: '#767586',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  skeletonCard: {
    backgroundColor: '#EDEAF7',
    borderRadius: 20,
    height: 130,
    marginBottom: 16,
  },
  badgeGrid: {
    gap: 10,
  },
  badgeCard: {
    backgroundColor: '#F7F4FF',
    borderRadius: 12,
    padding: 14,
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeIcon: {
    fontSize: 26,
  },
  badgeName: {
    color: '#1B1B23',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  badgeDate: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 96,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: '#1B1B23',
    fontSize: 22,
    fontWeight: '900',
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  placeholderText: {
    color: '#767586',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
