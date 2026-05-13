import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { auth, db } from '../config/firebase-config';
import { startRecording, stopRecording, transcribeAndAnalyze } from '../services/geminiAudio';
import { saveToHistory } from '../services/history-service';
import { setMode } from '../services/recordingState';
import { checkSessionSafety, notifySafetyFlag, saveSafetyFlag } from '../services/safety-service';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useCoachingStore } from '../stores/coaching-store';
import { useAuthStore } from '../stores/auth-store';
import { COLORS } from '../theme/colors';
import { radius, shadows } from '../theme/spacing';
import {
  calculateParentingScore,
  type CoachingReport,
  type ParentingAnalysis,
} from '../types/analysis';
import { getSessionTag, reportScoreFromData, toReportDate } from '../utils/reportUtils';

const shadowSm = Platform.select({
  web: {
    boxShadow: '0 18px 42px rgba(76, 29, 149, 0.10)',
  },
  ios: {
    ...shadows.card,
  },
  android: {
    elevation: shadows.card.elevation,
  },
  default: {},
}) as object;

const shadowButton = Platform.select({
  web: {
    boxShadow: '0 18px 36px rgba(91, 33, 182, 0.24)',
  },
  ios: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  android: {
    elevation: 6,
  },
  default: {},
}) as object;

type RecentSession = {
  id: string;
  childName: string;
  title: string;
  dateLabel: string;
  score: number;
};

function getTimeOfDayGreetingKey() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'home_good_morning';
  if (hour >= 12 && hour < 17) return 'home_good_afternoon';
  return 'home_good_evening';
}

function normalizeAnalysis(result: any): ParentingAnalysis {
  return {
    tone: result.tone || 'calm',
    confidence: Number(result.confidence || 0),
    emotional_intensity: Number(result.emotional_intensity || 0),
    parenting_style: result.parenting_style || 'authoritative',
    detected_issues: Array.isArray(result.detected_issues) ? result.detected_issues : [],
    suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    impact_analysis: String(result.impact_analysis || result.summary || ''),
    positive_notes: Array.isArray(result.positive_notes)
      ? result.positive_notes
      : Array.isArray(result.strengths)
      ? result.strengths
      : [],
  };
}

function StatCard({
  icon,
  iconColor,
  value,
  label,
  wide = false,
  desktop = false,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  wide?: boolean;
  desktop?: boolean;
}) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide, desktop && styles.statCardDesktop]}>
      <View style={styles.statIconWrap}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={wide ? styles.streakLabel : styles.statValue}>{value}</Text>
      <Text style={wide ? styles.streakValue : styles.statLabel}>{label}</Text>
    </View>
  );
}

function SessionCard({
  initial,
  avatarColor,
  title,
  date,
  score,
  scoreColor,
  onPress,
}: {
  initial: string;
  avatarColor: string;
  title: string;
  date: string;
  score: string;
  scoreColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.sessionCard} activeOpacity={0.82} onPress={onPress}>
      <View style={[styles.sessionAvatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.sessionAvatarText}>{initial}</Text>
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTitle}>{title}</Text>
        <Text style={styles.sessionDate}>{date}</Text>
      </View>

      <View style={styles.scoreBlock}>
        <Text style={[styles.sessionScore, { color: scoreColor }]}>{score}</Text>
        <Text style={styles.scoreLabel}>Score</Text>
      </View>
    </TouchableOpacity>
  );
}

export const HomeScreen: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { setCurrentAnalysis } = useCoachingStore();
  const { user: storeUser, profile } = useAuthStore();
  const isWide = width >= 768;
  const isDesktop = width > 1024;
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [tipOfDay, setTipOfDay] = useState('');
  const [isBackgroundRecording, setIsBackgroundRecording] = useState(false);
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false);
  const backgroundStartRef = useRef(0);
  const pulseValue = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!isBackgroundRecording) {
      pulseValue.setValue(0.45);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isBackgroundRecording, pulseValue]);

  useEffect(() => {
    let mounted = true;
    async function loadRecentSessions() {
      const user = auth.currentUser;
      if (!user) {
        if (mounted) {
          setRecentSessions([]);
          setRecentLoading(false);
        }
        return;
      }
      setRecentLoading(true);
      try {
        const snapshot = await getDocs(
          query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'), limit(2))
        );
        const nextTip =
          snapshot.docs
            .map((item) => {
              const data = item.data();
              const tips = Array.isArray(data.tips)
                ? data.tips
                : Array.isArray(data.analysis?.suggestions)
                ? data.analysis.suggestions
                : [];
              return tips.find((tip: unknown) => String(tip || '').trim().length > 0);
            })
            .find(Boolean) || '';

        const nextSessions = snapshot.docs.map((item) => {
          const data = item.data();
          const tagInfo = getSessionTag(String(data.tag || 'general'));
          const date = toReportDate(data.date || data.createdAt);
          return {
            id: item.id,
            childName: String(data.childName || 'Session'),
            title: `${data.childName || 'Session'} (${tagInfo.label})`,
            dateLabel: date.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            score: reportScoreFromData(data),
          };
        });
        if (mounted) {
          setRecentSessions(nextSessions);
          setTipOfDay(String(nextTip));
        }
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
        if (mounted) {
          setRecentSessions([]);
          setTipOfDay('');
        }
      } finally {
        if (mounted) setRecentLoading(false);
      }
    }

    loadRecentSessions();
    return () => {
      mounted = false;
    };
  }, []);

  const runBackgroundSafetyCheck = (report: CoachingReport) => {
    checkSessionSafety(report.transcript)
      .then(async (safety) => {
        if (!safety.safe) {
          await saveSafetyFlag(report.id, safety);
          await notifySafetyFlag(report.id, safety, () =>
            router.push({
              pathname: '/(drawer)/report-detail' as any,
              params: { id: report.id },
            })
          );
        }
      })
      .catch((error) => {
        console.warn('Background safety check failed:', error);
      });
  };

  const handleBackgroundCoachPress = async () => {
    if (isBackgroundProcessing) return;

    if (!isBackgroundRecording) {
      try {
        const lang = (await getStorageItem(STORAGE_KEYS.speechLanguage)) || 'en';
        await startRecording(undefined, lang);
        backgroundStartRef.current = Date.now();
        setMode('background');
        setIsBackgroundRecording(true);
      } catch (error: any) {
        Alert.alert(
          'Microphone Unavailable',
          error?.message || 'Please allow microphone access and try again.'
        );
      }
      return;
    }

    setIsBackgroundProcessing(true);
    try {
      const audioData = await stopRecording();
      setIsBackgroundRecording(false);
      setMode('idle');

      if (typeof audioData !== 'string' && audioData.size < 1000) {
        Alert.alert('Recording Too Short', 'Please record while speaking clearly, then try again.');
        return;
      }

      const lang = (await getStorageItem(STORAGE_KEYS.speechLanguage)) || 'en';
      const result = await transcribeAndAnalyze(audioData, lang);
      const normalizedAnalysis = normalizeAnalysis(result);
      const transcriptText = String(result?.transcript || '');

      if (transcriptText.trim().length < 2) {
        Alert.alert('No Speech Detected', 'Speak clearly and try again.');
        return;
      }

      const reportId = `background_${Date.now()}`;
      const summary = String(result.summary || normalizedAnalysis.impact_analysis || '');
      const strengths = Array.isArray(result.strengths)
        ? result.strengths
        : normalizedAnalysis.positive_notes;
      const improvements = Array.isArray(result.improvements)
        ? result.improvements
        : normalizedAnalysis.detected_issues;
      const tips = Array.isArray(result.tips) ? result.tips : normalizedAnalysis.suggestions;
      const report: CoachingReport = {
        id: reportId,
        createdAt: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round((Date.now() - backgroundStartRef.current) / 1000)),
        audioUri: typeof audioData === 'string' ? audioData : null,
        transcript: transcriptText,
        language: lang,
        mode: 'background',
        analysis: normalizedAnalysis,
        parentingScore: calculateParentingScore(normalizedAnalysis),
        childId: null,
        childName: null,
        tag: 'background',
        summary,
        strengths,
        improvements,
        tips,
        safetyFlag: result.safetyFlag
          ? {
              severity: 'mild',
              detected: [],
              recommendation: 'Review the coaching tips for this background session.',
            }
          : null,
      };

      setCurrentAnalysis(report);
      saveToHistory(report)
        .then(() => runBackgroundSafetyCheck(report))
        .catch((error) => {
          console.warn('Background report save failed:', error);
          runBackgroundSafetyCheck(report);
        });

      router.replace({
        pathname: '/(drawer)/session-results' as any,
        params: {
          reportId,
          safetyFlag: String(result.safetyFlag ?? false),
          childName: '',
          sessionTag: 'Background',
          durationSeconds: String(report.durationSeconds),
        },
      });
    } catch (error: any) {
      Alert.alert(
        'Background Coach Failed',
        error?.message || 'Could not analyze your background recording. Please try again.'
      );
      setIsBackgroundRecording(false);
      setMode('idle');
    } finally {
      setIsBackgroundProcessing(false);
    }
  };

  const displayName =
    profile?.displayName ||
    storeUser?.displayName ||
    auth.currentUser?.displayName ||
    auth.currentUser?.email?.split('@')[0] ||
    t('home_parent_fallback');
  const greeting = t('home_greeting_name', {
    greeting: t(getTimeOfDayGreetingKey()),
    name: displayName,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        isWide && styles.contentWide,
        isDesktop && styles.contentDesktop,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subtitle}>{t('home_ready_subtitle')}</Text>
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipIconBubble}>
          <MaterialIcons name="lightbulb-outline" size={24} color={COLORS.warning} />
        </View>
        <View style={styles.tipCopy}>
          <Text style={styles.tipTitle}>{t('home_tip_title')}</Text>
          <Text style={styles.tipText}>{tipOfDay || t('home_default_tip')}</Text>
        </View>
      </View>

      <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
        <StatCard
          icon="event"
          iconColor={COLORS.primaryDark}
          value="12"
          label={t('home_stats_sessions')}
          desktop={isDesktop}
        />
        <StatCard
          icon="speed"
          iconColor={COLORS.primary}
          value="78"
          label={t('home_stats_avg_score')}
          desktop={isDesktop}
        />
        <StatCard
          icon="local-fire-department"
          iconColor={COLORS.warning}
          value="5🔥"
          label={t('home_stats_current_streak')}
          wide={!isDesktop}
          desktop={isDesktop}
        />
      </View>

      <View style={[styles.actionArea, isDesktop && styles.actionAreaDesktop]}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryActionButton, isDesktop && styles.actionButtonDesktop]}
          activeOpacity={0.88}
          onPress={() => router.push('/(drawer)/coaching' as any)}
        >
          <MaterialIcons name="play-circle-outline" size={24} color={COLORS.onPrimary} />
          <Text style={styles.actionButtonText}>{t('home_start_live_coaching')}</Text>
        </TouchableOpacity>

        <View style={[styles.backgroundCoachGroup, isDesktop && styles.actionButtonDesktop]}>
          <TouchableOpacity
            style={[
              styles.backgroundCoachButton,
              isBackgroundRecording && styles.backgroundCoachButtonActive,
            ]}
            activeOpacity={0.88}
            onPress={handleBackgroundCoachPress}
            disabled={isBackgroundProcessing}
          >
            {isBackgroundProcessing ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : isBackgroundRecording ? (
              <Animated.View style={[styles.recordingPulse, { opacity: pulseValue }]} />
            ) : (
              <MaterialIcons name="settings-voice" size={24} color={COLORS.primary} />
            )}
            <Text
              style={[
                styles.secondaryActionButtonText,
                isBackgroundRecording && styles.backgroundCoachButtonTextActive,
              ]}
            >
              {isBackgroundProcessing
                ? t('home_background_processing')
                : isBackgroundRecording
                ? t('home_background_stop')
                : t('home_background_enable')}
            </Text>
          </TouchableOpacity>

          <View style={styles.privacyNote}>
            <MaterialIcons name="lock-outline" size={14} color={COLORS.textFaint} />
            <Text style={styles.privacyText}>
              {t('home_background_privacy')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home_recent_sessions')}</Text>
        <TouchableOpacity onPress={() => router.push('/(drawer)/history' as any)} activeOpacity={0.78}>
          <Text style={styles.viewAllText}>{t('home_view_all')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionsList}>
        {recentLoading ? (
          <View style={styles.sessionSkeleton}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.emptySessionsText}>{t('home_loading_recent')}</Text>
          </View>
        ) : recentSessions.length === 0 ? (
          <View style={styles.sessionSkeleton}>
            <MaterialIcons name="history" size={28} color={COLORS.primary} />
            <Text style={styles.emptySessionsText}>{t('home_no_sessions')}</Text>
          </View>
        ) : (
          recentSessions.map((session, index) => (
            <SessionCard
              key={session.id}
              initial={session.childName.trim()[0]?.toUpperCase() || 'S'}
              avatarColor={index % 2 === 0 ? COLORS.accent : COLORS.primary}
              title={session.title}
              date={session.dateLabel}
              score={String(session.score)}
              scoreColor={index % 2 === 0 ? COLORS.primaryDark : COLORS.primary}
              onPress={() =>
                router.push({
                  pathname: '/(drawer)/report-detail' as any,
                  params: { id: session.id },
                })
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },
  contentWide: {
    alignSelf: 'center',
    maxWidth: 1040,
    width: '100%',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  contentDesktop: {
    maxWidth: 1200,
    paddingHorizontal: 44,
    paddingTop: 52,
  },
  header: {
    marginBottom: 22,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 39,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 6,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 16,
    marginBottom: 22,
    ...shadowSm,
  },
  tipIconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: COLORS.surfaceContainerHigh,
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    color: COLORS.warning,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    color: COLORS.warning,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  statsGridDesktop: {
    flexWrap: 'nowrap',
    gap: 18,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 150,
    minHeight: 146,
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 18,
    justifyContent: 'space-between',
    ...shadowSm,
  },
  statCardDesktop: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 168,
  },
  statCardWide: {
    flexBasis: '100%',
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    justifyContent: 'flex-start',
  },
  statIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: COLORS.surfaceContainer,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    marginTop: 18,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  streakLabel: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  streakValue: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  actionArea: {
    gap: 16,
    marginBottom: 34,
  },
  actionAreaDesktop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 18,
  },
  backgroundCoachGroup: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    width: '100%',
    minHeight: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  actionButtonDesktop: {
    flex: 1,
    width: 'auto',
  },
  primaryActionButton: {
    backgroundColor: COLORS.primary,
    ...shadowButton,
  },
  secondaryActionButton: {
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.outline,
    borderWidth: 1,
  },
  backgroundCoachButton: {
    width: '100%',
    minHeight: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
    backgroundColor: COLORS.surfaceContainer,
    borderColor: COLORS.outline,
    borderWidth: 1,
  },
  backgroundCoachButtonActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
    ...shadowSm,
  },
  backgroundCoachButtonTextActive: {
    color: COLORS.onPrimary,
  },
  recordingPulse: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: COLORS.onPrimary,
    borderWidth: 3,
    borderColor: COLORS.errorBg,
  },
  backgroundToggleCard: {
    width: '100%',
    minHeight: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backgroundToggleCopy: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonText: {
    color: COLORS.onPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryActionButtonText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  privacyNote: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
  },
  privacyText: {
    color: COLORS.textFaint,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  viewAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  sessionsList: {
    gap: 14,
  },
  sessionSkeleton: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    gap: 8,
    padding: 22,
    ...shadowSm,
  },
  emptySessionsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.cardBg,
    borderRadius: radius.xl,
    padding: 16,
    ...shadowSm,
  },
  sessionAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: radius.full,
  },
  sessionAvatarText: {
    color: COLORS.onPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sessionDate: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  scoreBlock: {
    alignItems: 'center',
    minWidth: 48,
  },
  sessionScore: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default HomeScreen;



