import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { COLORS } from '../../src/theme/colors';
import { radius, shadows } from '../../src/theme/spacing';
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

type AggregatedPattern = {
  text: string;
  count: number;
};

const PATTERN_REPORT_LIMIT = 10;

function localeForLanguage(language?: string) {
  if (language?.startsWith('ar')) return 'ar';
  if (language?.startsWith('tr')) return 'tr-TR';
  return 'en-US';
}

const badgeDefinitions = (reports: FirestoreReport[], t?: (key: string) => string): BadgeState[] => {
  const translate = t || ((key: string) => key);
  const uniqueDays = new Set(reports.map((report) => report.date.toISOString().slice(0, 10)));
  return [
    {
      id: 'first_steps',
      icon: '*',
      name: translate('achievement_first_step_title'),
      earned: reports.length >= 1,
      requirement: translate('achievement_first_step_unlock'),
    },
    {
      id: 'on_a_roll',
      icon: '*',
      name: translate('achievement_three_day_streak_title'),
      earned: reports.length >= 3,
      requirement: translate('achievement_three_day_streak_unlock'),
    },
    {
      id: 'committed_parent',
      icon: '*',
      name: translate('achievement_active_listener_title'),
      earned: reports.length >= 10,
      requirement: translate('achievement_active_listener_unlock'),
    },
    {
      id: 'high_scorer',
      icon: '*',
      name: translate('achievement_calm_voice_title'),
      earned: reports.some((report) => report.score > 80),
      requirement: translate('achievement_calm_voice_unlock'),
    },
    {
      id: 'consistent',
      icon: '*',
      name: translate('achievement_consistent_routine_title'),
      earned: uniqueDays.size >= 3,
      requirement: translate('achievement_three_day_streak_unlock'),
    },
    {
      id: 'excellence',
      icon: '*',
      name: translate('achievement_role_model_title'),
      earned: reports.some((report) => report.score > 90),
      requirement: translate('achievement_role_model_unlock'),
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
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

function normalizePatternText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areSimilarPatterns(a: string, b: string) {
  const first = normalizePatternText(a);
  const second = normalizePatternText(b);
  if (!first || !second) return false;
  if (first === second || first.includes(second) || second.includes(first)) return true;

  const firstWords = new Set(first.split(' ').filter((word) => word.length > 3));
  const secondWords = new Set(second.split(' ').filter((word) => word.length > 3));
  if (!firstWords.size || !secondWords.size) return false;

  const shared = [...firstWords].filter((word) => secondWords.has(word)).length;
  return shared / Math.min(firstWords.size, secondWords.size) >= 0.75;
}

function aggregatePatterns(reports: FirestoreReport[], field: 'strengths' | 'improvements') {
  const patternMap = new Map<string, AggregatedPattern & { latestIndex: number }>();

  reports.slice(0, PATTERN_REPORT_LIMIT).forEach((report, reportIndex) => {
    report[field].forEach((rawPattern) => {
      const text = String(rawPattern || '').trim();
      if (!text) return;

      const existing = patternMap.get(text);
      if (existing) {
        existing.count += 1;
        existing.latestIndex = Math.min(existing.latestIndex, reportIndex);
      } else {
        patternMap.set(text, { text, count: 1, latestIndex: reportIndex });
      }
    });
  });

  const ranked = [...patternMap.values()].sort(
    (a, b) => b.count - a.count || a.latestIndex - b.latestIndex
  );
  const distinct: AggregatedPattern[] = [];

  ranked.forEach((pattern) => {
    if (distinct.length >= 4) return;
    if (!distinct.some((existing) => areSimilarPatterns(existing.text, pattern.text))) {
      distinct.push({ text: pattern.text, count: pattern.count });
    }
  });

  return distinct;
}

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
          stroke={COLORS.ringTrack}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.ringFill}
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

function ProgressLine({
  reports,
  locale,
  emptyText,
}: {
  reports: FirestoreReport[];
  locale: string;
  emptyText: string;
}) {
  const chartReports = reports.slice(-7);

  if (chartReports.length === 0) {
    return <Text style={styles.placeholderText}>{emptyText}</Text>;
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
              {report.date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1)}
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
          <MaterialIcons name={icon} size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function AchievementsSection({ badges, title }: { badges: BadgeState[]; title: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBubble}>
          <MaterialIcons name="emoji-events" size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((badge) => (
          <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
            <Text style={styles.badgeIcon}>{badge.earned ? badge.icon : '-'}</Text>
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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = localeForLanguage(i18n.language);
  const [reports, setReports] = useState<FirestoreReport[]>([]);
  const [children, setChildren] = useState<ChildFilter[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'week' | 'month' | '3m'>('all');
  const [badges, setBadges] = useState<BadgeState[]>(badgeDefinitions([], t));
  const [loading, setLoading] = useState(true);

  const updateBadges = useCallback(async (userId: string, sourceReports: FirestoreReport[]) => {
    const definitions = badgeDefinitions(sourceReports, t);
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
  }, [t]);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      console.log('Fetched reports:', 0);
      setReports([]);
      setChildren([]);
      setBadges(badgeDefinitions([], t));
      setLoading(false);
      return;
    }

    const reportsQuery = query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'));
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
        setBadges(badgeDefinitions([], t));
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
  }, [t, updateBadges]);

  const visibleReports = useMemo(() => {
    const periodReports =
      selectedPeriod === 'all'
        ? reports
        : reports.filter((report) => {
            const now = Date.now();
            const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 90;
            const cutoff = now - days * 24 * 60 * 60 * 1000;
            return report.date.getTime() >= cutoff;
          });
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

  const communicationPatterns = useMemo(
    () => ({
      strengths: aggregatePatterns(visibleReports, 'strengths'),
      improvements: aggregatePatterns(visibleReports, 'improvements'),
    }),
    [visibleReports]
  );
  const patternReportCount = Math.min(visibleReports.length, PATTERN_REPORT_LIMIT);
  const patternSubtitle =
    patternReportCount === 1
      ? t('insights_patterns_first_session')
      : t('insights_patterns_recent_sessions', { count: patternReportCount });

  const qualitativeBanner = useMemo(() => {
    if (summary.averageScore > 80) {
      return t('insights_banner_great');
    }
    if (summary.averageScore >= 50) {
      return t('insights_banner_progress');
    }
    return t('insights_banner_support');
  }, [summary.averageScore, t]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>{t('insights_overview')}</Text>
        <Text style={styles.pageSubtitle}>{t('insights_subtitle')}</Text>
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
            {t('insights_all')}
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
          { id: 'all', label: t('insights_all') },
          { id: 'week', label: t('insights_week') },
          { id: 'month', label: t('insights_month') },
          { id: '3m', label: t('insights_3m') },
        ].map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[styles.periodTab, selectedPeriod === period.id && styles.periodTabActive]}
            onPress={() => setSelectedPeriod(period.id as 'all' | 'week' | 'month' | '3m')}
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
          <Text style={styles.placeholderText}>{t('insights_loading')}</Text>
          <SkeletonInsights />
        </>
      ) : visibleReports.length === 0 ? (
        <>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>-</Text>
            <Text style={styles.emptyTitle}>{t('insights_empty_title')}</Text>
            <Text style={styles.placeholderText}>
              {t('insights_empty_text')}
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/coaching' as any)}>
              <Text style={styles.emptyButtonText}>{t('insights_start_session')}</Text>
            </TouchableOpacity>
          </View>
          <AchievementsSection badges={badges} title={t('insights_achievements')} />
        </>
      ) : (
        <>
          <View style={styles.qualitativeBanner}>
            <MaterialIcons name="favorite" size={20} color={COLORS.primary} />
            <Text style={styles.qualitativeBannerText}>{qualitativeBanner}</Text>
          </View>

          <View style={styles.averageCard}>
            <Text style={styles.averageTitle}>{t('insights_avg_score')}</Text>
            <ScoreRing score={summary.averageScore} />
            <Text style={styles.averageFooter}>{t('insights_average_footer')}</Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              icon="event-note"
              iconBg={COLORS.surfaceContainer}
              iconColor={COLORS.primary}
              value={String(summary.totalSessions)}
              label={t('insights_sessions')}
            />
            <StatCard
              icon="speed"
              iconBg={COLORS.surfaceContainerHigh}
              iconColor={COLORS.primaryDark}
              value={String(summary.averageScore)}
              label={t('insights_avg_score')}
            />
            <StatCard
              icon="local-fire-department"
              iconBg={COLORS.warningBg}
              iconColor={COLORS.warning}
              value={String(summary.streak)}
              label={t('insights_streak_days')}
            />
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>{t('insights_chart_last7')}</Text>
            <ProgressLine
              reports={summary.chronologicalReports}
              locale={locale}
              emptyText={t('insights_no_data')}
            />
          </View>

          <View style={styles.patternSection}>
            <View>
              <Text style={styles.patternSectionTitle}>{t('insights_patterns')}</Text>
              <Text style={styles.patternSectionSubtitle}>{patternSubtitle}</Text>
            </View>
            <View style={styles.patternGrid}>
              <PatternListCard
                variant="strength"
                title={t('insights_superpowers')}
                items={communicationPatterns.strengths}
                emptyText={t('insights_patterns_empty_strength')}
              />
              <PatternListCard
                variant="growth"
                title={t('insights_growth_areas')}
                items={communicationPatterns.improvements}
                emptyText={t('insights_patterns_empty_growth')}
              />
            </View>
          </View>

          <View style={styles.coachSection}>
            <Text style={styles.sectionHeading}>{t('insights_coach_insights')}</Text>
            <View style={[styles.coachCard, styles.strengthCard]}>
              <View style={styles.coachIconWrap}>
                <MaterialIcons name="check-circle" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachCardTitle}>{t('insights_top_strength')}</Text>
                <Text style={styles.coachCardText}>
                  {summary.topStrength || t('insights_no_data_yet')}
                </Text>
              </View>
            </View>
            <View style={[styles.coachCard, styles.improvementCard]}>
              <View style={styles.coachIconWrap}>
                <MaterialIcons name="build" size={24} color={COLORS.warning} />
              </View>
              <View style={styles.coachTextWrap}>
                <Text style={styles.coachCardTitle}>{t('insights_top_improvement')}</Text>
                <Text style={styles.coachCardText}>
                  {summary.topImprovement || t('insights_no_data_yet')}
                </Text>
              </View>
            </View>
          </View>

          {summary.lastSession && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionHeading}>{t('insights_recent')}</Text>
              <View style={styles.recentCard}>
                <View style={styles.recentIcon}>
                  <MaterialIcons name="description" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.recentCopy}>
                  <Text style={styles.recentTitle}>
                    {t('insights_last_session', { name: summary.lastSession.childName || t('history_default_child') })}
                  </Text>
                  <Text style={styles.recentTime}>
                    {summary.lastSession.date.toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '} - {summary.lastSession.score}/100
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
                  <Text style={styles.reportButtonText}>{t('insights_view_report')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <AchievementsSection badges={badges} title={t('insights_achievements')} />
        </>
      )}
    </ScrollView>
  );
}

function PatternListCard({
  variant,
  title,
  items,
  emptyText,
}: {
  variant: 'strength' | 'growth';
  title: string;
  items: AggregatedPattern[];
  emptyText: string;
}) {
  const isStrength = variant === 'strength';
  const displayItems = items.length ? items : [{ text: emptyText, count: 0 }];
  return (
    <View style={[styles.patternCard, isStrength ? styles.patternCardStrength : styles.patternCardGrowth]}>
      <Text style={[styles.patternCardTitle, isStrength ? styles.patternTitleStrength : styles.patternTitleGrowth]}>
        {title}
      </Text>
      <View style={styles.patternList}>
        {displayItems.map((item, index) => (
          <View key={`${variant}-${index}-${item.text}`} style={styles.patternRow}>
            <MaterialIcons
              name={isStrength ? 'stars' : 'track-changes'}
              size={18}
              color={isStrength ? COLORS.success : COLORS.warning}
              style={styles.patternIcon}
            />
            <Text style={[styles.patternText, isStrength ? styles.patternTextStrength : styles.patternTextGrowth]}>
              {item.text}
            </Text>
            {item.count > 0 ? (
              <View style={[styles.patternCountPill, isStrength ? styles.patternCountStrength : styles.patternCountGrowth]}>
                <Text style={[styles.patternCountText, isStrength ? styles.patternCountTextStrength : styles.patternCountTextGrowth]}>
                  {item.count}x
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: COLORS.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  pageSubtitle: {
    color: COLORS.textSecondary,
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
    borderColor: COLORS.border,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  childFilter: {
    borderRadius: radius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: 'transparent',
  },
  childFilterActive: {
    backgroundColor: COLORS.primary,
  },
  childFilterText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  childFilterTextActive: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
  },
  periodTab: {
    borderColor: COLORS.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  periodTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  periodTabTextActive: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  qualitativeBanner: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  qualitativeBannerText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  averageCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xxl,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 26,
    shadowColor: COLORS.primaryDark,
    shadowOffset: shadows.overlay.shadowOffset,
    shadowOpacity: shadows.overlay.shadowOpacity,
    shadowRadius: shadows.overlay.shadowRadius,
    elevation: shadows.overlay.elevation,
    ...Platform.select({
      web: {
        boxShadow: '0px 24px 60px rgba(76, 29, 149, 0.14)',
      } as any,
    }),
  },
  averageTitle: {
    alignSelf: 'flex-start',
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
  },
  averageFooter: {
    color: COLORS.textSecondary,
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
    color: COLORS.primary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
  },
  ringLabel: {
    color: COLORS.textFaint,
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
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 16,
    shadowColor: COLORS.primaryDark,
    shadowOffset: shadows.card.shadowOffset,
    shadowOpacity: shadows.card.shadowOpacity,
    shadowRadius: shadows.card.shadowRadius,
    elevation: shadows.card.elevation,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 34px rgba(76, 29, 149, 0.09)',
      } as any,
    }),
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 30,
  },
  statLabel: {
    color: COLORS.textFaint,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 20,
    shadowColor: COLORS.primaryDark,
    shadowOffset: shadows.card.shadowOffset,
    shadowOpacity: shadows.card.shadowOpacity,
    shadowRadius: shadows.card.shadowRadius,
    elevation: shadows.card.elevation,
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 42px rgba(76, 29, 149, 0.10)',
      } as any,
    }),
  },
  chartTitle: {
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: radius.full,
  },
  barFillLatest: {
    backgroundColor: COLORS.primary,
  },
  chartLabel: {
    color: COLORS.textFaint,
    fontSize: 11,
    fontWeight: '800',
  },
  patternSection: {
    gap: 12,
  },
  patternSectionTitle: {
    color: COLORS.textFaint,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  patternSectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  patternCard: {
    borderRadius: radius.xl,
    flexBasis: 280,
    flexGrow: 1,
    padding: 18,
    shadowColor: COLORS.primaryDark,
    shadowOffset: shadows.card.shadowOffset,
    shadowOpacity: shadows.card.shadowOpacity,
    shadowRadius: shadows.card.shadowRadius,
    elevation: shadows.card.elevation,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 34px rgba(76, 29, 149, 0.08)',
      } as any,
    }),
  },
  patternCardStrength: {
    backgroundColor: COLORS.successBg,
    
  },
  patternCardGrowth: {
    backgroundColor: COLORS.warningBg,
    
  },
  patternCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
    marginBottom: 14,
  },
  patternTitleStrength: {
    color: COLORS.successText,
  },
  patternTitleGrowth: {
    color: COLORS.warning,
  },
  patternList: {
    gap: 12,
  },
  patternRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  patternIcon: {
    marginTop: 1,
  },
  patternText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  patternCountPill: {
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  patternCountStrength: {
    backgroundColor: COLORS.successBorder,
  },
  patternCountGrowth: {
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  patternCountText: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  patternCountTextStrength: {
    color: COLORS.successText,
  },
  patternCountTextGrowth: {
    color: COLORS.warning,
  },
  patternTextStrength: {
    color: COLORS.successText,
  },
  patternTextGrowth: {
    color: COLORS.warning,
  },
  coachSection: {
    gap: 12,
  },
  sectionHeading: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radius.xl,
    padding: 16,
    borderLeftWidth: 5,
  },
  strengthCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderLeftColor: COLORS.primary,
  },
  improvementCard: {
    backgroundColor: COLORS.warningBg,
    borderLeftColor: COLORS.warning,
  },
  coachIconWrap: {
    marginTop: 2,
  },
  coachTextWrap: {
    flex: 1,
  },
  coachCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  coachCardText: {
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 16,
    shadowColor: COLORS.primaryDark,
    shadowOffset: shadows.card.shadowOffset,
    shadowOpacity: shadows.card.shadowOpacity,
    shadowRadius: shadows.card.shadowRadius,
    elevation: shadows.card.elevation,
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 42px rgba(76, 29, 149, 0.10)',
      } as any,
    }),
  },
  recentIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceContainer,
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  recentTime: {
    color: COLORS.textFaint,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  reportButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: radius.full,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  reportButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 18,
    ...shadows.card,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  iconBubble: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: radius.xl,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionTitle: {
    color: COLORS.textFaint,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardValue: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  cardSubtitle: {
    color: COLORS.textFaint,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  skeletonCard: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: radius.xl,
    height: 130,
    marginBottom: 16,
  },
  badgeGrid: {
    gap: 10,
  },
  badgeCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: radius.lg,
    padding: 14,
  },
  badgeCardLocked: {
    opacity: 0.45,
  },
  badgeIcon: {
    fontSize: 26,
  },
  badgeName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
  },
  badgeDate: {
    color: COLORS.textFaint,
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
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: radius.full,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: COLORS.onPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  placeholderText: {
    color: COLORS.textFaint,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
