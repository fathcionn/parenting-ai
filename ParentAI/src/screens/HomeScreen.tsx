import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase-config';
import { setMode } from '../services/recordingState';
import { STORAGE_KEYS } from '../services/storageKeys';
import { getSessionTag, reportScoreFromData, toReportDate } from '../utils/reportUtils';

const COLORS = {
  background: '#FCF8FF',
  text: '#1B1B23',
  subtext: '#464554',
  muted: '#6B7280',
  card: '#FFFFFF',
  tipBg: '#FEFCE8',
  tipBorder: '#FEF08A',
  tipIcon: '#CA8A04',
  tipTitle: '#854D0E',
  tipText: '#A16207',
  purple: '#7C3AED',
  indigo: '#4F46E5',
  orange: '#EA580C',
  streak: '#904900',
  leo: '#6366F1',
  mia: '#8B5CF6',
};

const shadowSm = Platform.select({
  web: {
    boxShadow: '0 8px 24px rgba(17, 24, 39, 0.08)',
  },
  ios: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  android: {
    elevation: 3,
  },
  default: {},
}) as object;

const shadowButton = Platform.select({
  web: {
    boxShadow: '0 14px 28px rgba(124, 58, 237, 0.28)',
  },
  ios: {
    shadowColor: COLORS.purple,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
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
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isDesktop = width > 1024;
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [backgroundAssistantEnabled, setBackgroundAssistantEnabled] = useState(false);

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
        if (mounted) setRecentSessions(nextSessions);
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
        if (mounted) setRecentSessions([]);
      } finally {
        if (mounted) setRecentLoading(false);
      }
    }

    loadRecentSessions();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleBackgroundAssistant = async (value: boolean) => {
    setBackgroundAssistantEnabled(value);
    setMode(value ? 'background' : 'idle');
    await AsyncStorage.setItem(STORAGE_KEYS.autoMonitor, value ? 'true' : 'false');
  };

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
        <Text style={styles.greeting}>Good morning, Sarah {'\u{1F44B}'}</Text>
        <Text style={styles.subtitle}>Ready for today's coaching session?</Text>
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipIconBubble}>
          <MaterialIcons name="lightbulb-outline" size={24} color={COLORS.tipIcon} />
        </View>
        <View style={styles.tipCopy}>
          <Text style={styles.tipTitle}>Tip of the day</Text>
          <Text style={styles.tipText}>Use 'I feel...' statements instead of 'You always...'</Text>
        </View>
      </View>

      <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
        <StatCard
          icon="event"
          iconColor={COLORS.indigo}
          value="12"
          label="Sessions"
          desktop={isDesktop}
        />
        <StatCard
          icon="speed"
          iconColor={COLORS.purple}
          value="78"
          label="Avg Score"
          desktop={isDesktop}
        />
        <StatCard
          icon="local-fire-department"
          iconColor={COLORS.orange}
          value="Current Streak"
          label="5🔥"
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
          <MaterialIcons name="play-circle-outline" size={24} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Start Live Coaching</Text>
        </TouchableOpacity>

        <View style={[styles.backgroundCoachGroup, isDesktop && styles.actionButtonDesktop]}>
          <View style={[styles.backgroundToggleCard, styles.secondaryActionButton]}>
            <View style={styles.backgroundToggleCopy}>
              <MaterialIcons name="settings-voice" size={24} color={COLORS.purple} />
              <Text style={styles.secondaryActionButtonText}>Enable Background Coach</Text>
            </View>
            <Switch
              value={backgroundAssistantEnabled}
              onValueChange={toggleBackgroundAssistant}
              trackColor={{ false: '#D8D4E5', true: '#C4B5FD' }}
              thumbColor={backgroundAssistantEnabled ? COLORS.purple : '#FFFFFF'}
            />
          </View>

          <View style={styles.privacyNote}>
            <MaterialIcons name="lock-outline" size={14} color="#767586" />
            <Text style={styles.privacyText}>
              Audio is securely analyzed and never stored permanently.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <TouchableOpacity onPress={() => router.push('/(drawer)/history' as any)} activeOpacity={0.78}>
          <Text style={styles.viewAllText}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionsList}>
        {recentLoading ? (
          <View style={styles.sessionSkeleton}>
            <ActivityIndicator color={COLORS.purple} />
            <Text style={styles.emptySessionsText}>Loading recent sessions...</Text>
          </View>
        ) : recentSessions.length === 0 ? (
          <View style={styles.sessionSkeleton}>
            <MaterialIcons name="history" size={28} color={COLORS.purple} />
            <Text style={styles.emptySessionsText}>No sessions yet</Text>
          </View>
        ) : (
          recentSessions.map((session, index) => (
            <SessionCard
              key={session.id}
              initial={session.childName.trim()[0]?.toUpperCase() || 'S'}
              avatarColor={index % 2 === 0 ? COLORS.leo : COLORS.mia}
              title={session.title}
              date={session.dateLabel}
              score={String(session.score)}
              scoreColor={index % 2 === 0 ? COLORS.indigo : COLORS.purple}
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
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 39,
  },
  subtitle: {
    color: COLORS.subtext,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginTop: 6,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: COLORS.tipBg,
    borderColor: COLORS.tipBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    ...shadowSm,
  },
  tipIconBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    color: COLORS.tipTitle,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    color: COLORS.tipText,
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
    backgroundColor: COLORS.card,
    borderRadius: 22,
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
    borderRadius: 22,
    backgroundColor: '#F5F3FF',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    marginTop: 18,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  streakLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  streakValue: {
    color: COLORS.streak,
    fontSize: 28,
    fontWeight: '800',
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
    borderRadius: 999,
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
    backgroundColor: COLORS.purple,
    ...shadowButton,
  },
  secondaryActionButton: {
    backgroundColor: '#EFECF8',
    borderColor: '#D8B4FE',
    borderWidth: 1,
  },
  backgroundToggleCard: {
    width: '100%',
    minHeight: 60,
    borderRadius: 999,
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryActionButtonText: {
    color: COLORS.purple,
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
    color: '#767586',
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
    color: COLORS.text,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  viewAllText: {
    color: COLORS.purple,
    fontSize: 14,
    fontWeight: '800',
  },
  sessionsList: {
    gap: 14,
  },
  sessionSkeleton: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    gap: 8,
    padding: 22,
    ...shadowSm,
  },
  emptySessionsText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    ...shadowSm,
  },
  sessionAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  sessionAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  sessionDate: {
    color: COLORS.muted,
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
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});

export default HomeScreen;



