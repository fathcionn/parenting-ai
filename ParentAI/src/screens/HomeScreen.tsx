import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../config/firebase-config';
import {
    getMicStream,
    startRecording,
    stopRecording,
    transcribeAndAnalyze,
} from '../services/geminiAudio';
import { saveToHistory } from '../services/history-service';
import { getRecordingMeteringLevel } from '../services/nativeAudio';
import {
    getAutoMonitorPreference,
    setAutoMonitorPreference,
    setMode,
} from '../services/recordingState';
import { checkSessionSafety, notifySafetyFlag, saveSafetyFlag } from '../services/safety-service';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { COLORS } from '../theme/colors';
import { calculateParentingScore, type ParentingAnalysis } from '../types/analysis';
import { getSessionTag, reportScoreFromData, toReportDate } from '../utils/reportUtils';

const DAILY_TIPS = [
  "Use 'I feel...' statements instead of 'You always...'",
  'Give your child 2 choices instead of commands',
  'Praise effort, not just results',
  "Get down to your child's eye level when talking",
  "Ask 'What was the best part of your day?' at dinner",
  'Pause for one breath before responding to conflict',
  'Name the emotion before correcting the behavior',
  'Use a calm voice even when setting a firm boundary',
  'Offer help before assuming defiance',
  'Catch one good behavior and name it out loud',
  'Keep instructions short and specific',
  'Replace threats with clear consequences',
  'Use routines to reduce repeated arguments',
  'Ask curious questions before giving advice',
  'Validate feelings while keeping the limit',
  'Give warnings before transitions',
  'Use repair language after a hard moment',
  'Avoid labels; describe the behavior instead',
  'Let your child repeat the plan back to you',
  'Celebrate small steps toward self-control',
  'Make eye contact before giving an instruction',
  'Use humor gently to lower tension',
  'Give attention before your child has to demand it',
  'Separate your child from the problem',
  'Practice the phrase you want them to use',
  'Ask what support would help next time',
  'Choose connection before correction when possible',
  'Keep consequences related and respectful',
  'End tough talks with reassurance',
  'Notice your own tone as early feedback',
];

function isConnectionError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('fetch') || message.includes('network') || message.includes('server');
}

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function normalizeAnalysis(result: any): ParentingAnalysis {
  return {
    tone: result.tone || 'calm',
    confidence: Number(result.confidence || 0),
    emotional_intensity: Number(result.emotional_intensity || 0),
    parenting_style: result.parenting_style || 'authoritative',
    detected_issues: Array.isArray(result.detected_issues) ? result.detected_issues : [],
    suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
    impact_analysis: String(result.impact_analysis || ''),
    positive_notes: Array.isArray(result.positive_notes) ? result.positive_notes : [],
  };
}

type HomeReport = {
  id: string;
  score: number;
  date: Date;
  summary: string;
  durationSeconds?: number;
  childName?: string | null;
  tag?: string | null;
  strengths: string[];
  improvements: string[];
  tips: string[];
  safetyFlag?: any;
};

const formatSessionDate = (date: Date) =>
  date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function SkeletonCard() {
  const opacity = React.useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonWrapper, { opacity }]}>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonTopRow}>
          <View style={styles.skeletonTag} />
          <View style={styles.skeletonScore} />
        </View>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLineFull} />
        <View style={styles.skeletonLineShort} />
      </View>
    </Animated.View>
  );
}

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const startedAtRef = React.useRef(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const hasAutoStarted = React.useRef(false);
  const animFrameRef = React.useRef<number>(0);
  const meteringIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const pendingAudioRef = React.useRef<Blob | string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(2));
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [homeReports, setHomeReports] = useState<HomeReport[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState('');

  const loadHomeReports = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setHomeReports([]);
      setHomeLoading(false);
      return;
    }

    setHomeLoading(true);
    setHomeError('');
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'))
      );
      setHomeReports(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            score: reportScoreFromData(data),
            date: toReportDate(data.date || data.createdAt),
            summary: String(data.summary || data.analysis?.impact_analysis || ''),
            durationSeconds: Number(data.durationSeconds || 0),
            childName: data.childName || null,
            tag: data.tag || 'general',
            strengths: Array.isArray(data.strengths) ? data.strengths : data.analysis?.positive_notes || [],
            improvements: Array.isArray(data.improvements)
              ? data.improvements
              : data.analysis?.detected_issues || [],
            tips: Array.isArray(data.tips) ? data.tips : data.analysis?.suggestions || [],
            safetyFlag: data.safetyFlag || null,
          };
        })
      );
    } catch (error) {
      console.error('Failed to load home reports:', error);
      setHomeReports([]);
      setHomeError('Could not load your latest sessions.');
    } finally {
      setHomeLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHomeReports();
    }, [loadHomeReports])
  );

  const homeSummary = useMemo(() => {
    const sessions = homeReports.length;
    const averageScore = sessions
      ? Math.round(homeReports.reduce((sum, report) => sum + report.score, 0) / sessions)
      : 0;
    const focusLevel = sessions === 0 ? '--' : averageScore >= 80 ? 'High' : averageScore >= 50 ? 'Steady' : 'Needs care';
    return { sessions, averageScore, focusLevel };
  }, [homeReports]);

  useEffect(() => {
    getAutoMonitorPreference().then((value) => {
      setAutoMonitor(value);
      if (value && !hasAutoStarted.current) {
        hasAutoStarted.current = true;
        startMonitor();
      }
    });
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isMonitoring) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring]);

  useEffect(() => {
    if (!isMonitoring) {
      pulseAnim.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [isMonitoring, pulseAnim]);

  useEffect(() => {
    return () => stopWaveform();
  }, []);

  function startWaveform(stream: MediaStream | null) {
    if (Platform.OS !== 'web') {
      meteringIntervalRef.current = setInterval(async () => {
        const level = await getRecordingMeteringLevel();
        const bars = Array.from({ length: 40 }, () => Math.max(3, Math.random() * level * 60));
        setWaveformBars(bars);
      }, 100);
      return;
    }

    if (!stream) return;
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      analyser.getByteFrequencyData(dataArray);
      const bars = Array.from({ length: 40 }, (_, index) => {
        const dataIndex = Math.floor((index / 40) * dataArray.length);
        return Math.max(3, (dataArray[dataIndex] / 255) * 60);
      });
      setWaveformBars(bars);
      animFrameRef.current = requestAnimationFrame(draw);
    }
    draw();
  }

  function stopWaveform() {
    cancelAnimationFrame(animFrameRef.current);
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setWaveformBars(Array(40).fill(2));
  }

  async function startMonitor() {
    setErrorMessage('');
    setSuccessMessage('');
    setElapsedSeconds(0);
    try {
      const micId = await getStorageItem(STORAGE_KEYS.micId) || 'default';
      const lang = await getStorageItem(STORAGE_KEYS.speechLanguage) || 'en';
      await startRecording(micId, lang);
      const stream = getMicStream();
      startWaveform(stream);
      startedAtRef.current = Date.now();
      setMode('background');
      setIsMonitoring(true);
    } catch (err: any) {
      setErrorMessage(`${t('error_mic_blocked')} ${err.message}`);
    }
  }

  async function stopAndAnalyzeMonitor() {
    setIsMonitoring(false);
    setMode('idle');
    stopWaveform();
    setIsLoading(true);

    try {
      const audioData = await stopRecording();
      pendingAudioRef.current = audioData;
      if (typeof audioData !== 'string' && audioData.size < 1000) {
        setErrorMessage(t('error_no_speech'));
        setIsLoading(false);
        return;
      }

      await analyzeMonitorAudio(audioData);
    } catch (err: any) {
      if (isConnectionError(err)) {
        Alert.alert('Connection Issue', 'Could not reach the server. Please check your internet connection and try again.', [
          { text: 'Retry', onPress: () => retryAnalysis() },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        setErrorMessage(`${t('error_analysis_failed')} ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function retryAnalysis() {
    if (!pendingAudioRef.current) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      await analyzeMonitorAudio(pendingAudioRef.current);
    } catch (err: any) {
      setErrorMessage(`${t('error_analysis_failed')} ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeMonitorAudio(audioData: Blob | string) {
    const lang = await getStorageItem(STORAGE_KEYS.speechLanguage) || 'en';
    const result = await transcribeAndAnalyze(audioData, lang);
    const analysis = normalizeAnalysis(result);
    const transcript = String(result.transcript || '');

    if (transcript.trim().length < 2) {
      setErrorMessage(t('error_no_speech'));
      setIsLoading(false);
      return;
    }

    const reportId = `report_${Date.now()}`;
    await saveToHistory({
      id: reportId,
      createdAt: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
      audioUri: typeof audioData === 'string' ? audioData : null,
      transcript,
      language: lang,
      analysis,
      parentingScore: calculateParentingScore(analysis),
      mode: 'background',
      summary: String(result.summary || analysis.impact_analysis || ''),
      strengths: Array.isArray(result.strengths) ? result.strengths : analysis.positive_notes,
      improvements: Array.isArray(result.improvements) ? result.improvements : analysis.detected_issues,
      tips: Array.isArray(result.tips) ? result.tips : analysis.suggestions,
      tag: 'general',
    });

    try {
      const safety = await checkSessionSafety(transcript);
      if (!safety.safe) {
        await saveSafetyFlag(reportId, safety);
        await notifySafetyFlag(reportId, safety, () =>
          router.push({
            pathname: '/(drawer)/report-detail' as any,
            params: { id: reportId },
          })
        );
      }
    } catch (safetyError) {
      console.warn('Safety check failed:', safetyError);
    }

    setSuccessMessage(t('home_session_saved'));
  }

  const handleToggleAutoMonitor = async (value: boolean) => {
    setAutoMonitor(value);
    await setAutoMonitorPreference(value);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.monitorBar}>
        <View>
          <Text style={styles.monitorKicker}>
            {isMonitoring ? 'COACHING ACTIVE' : 'BACKGROUND ASSISTANT READY'}
          </Text>
          <Text style={styles.monitorMeta}>
            {isMonitoring ? formatTime(elapsedSeconds) : 'Background Assistant is off'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.monitorButton, isMonitoring && styles.monitorButtonActive]}
          activeOpacity={0.85}
          onPress={isMonitoring ? stopAndAnalyzeMonitor : startMonitor}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={isMonitoring ? COLORS.primary : COLORS.cardBg} />
          ) : (
            <View style={styles.monitorButtonTextWrap}>
              <Text style={[styles.monitorButtonText, isMonitoring && styles.monitorButtonTextActive]}>
                {isMonitoring ? 'Pause Assistant' : 'Enable Background Listening'}
              </Text>
              <Text style={[styles.monitorButtonCaption, isMonitoring && styles.monitorButtonCaptionActive]}>
                Passive background mode
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, Parent {'\u{1F44B}'}</Text>
        <Text style={styles.headerSubtitle}>Here is your TalkWise overview for today.</Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {isMonitoring ? (
        <View style={styles.liveCard}>
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
            <FontAwesome name="microphone" size={24} color={COLORS.onPrimary} />
          </Animated.View>
          <View style={styles.waveform}>
            {waveformBars.map((bar, index) => (
              <View key={index} style={[styles.waveformBar, { height: bar }]} />
            ))}
          </View>
          <Text style={styles.liveText}>{t('home_subtitle_on')}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{homeLoading ? '...' : homeSummary.sessions}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <TouchableOpacity
            style={styles.statInfoButton}
            onPress={() =>
              Alert.alert(
                'Avg Score',
                'Your average coaching score across all sessions. Scores above 80 indicate positive, calm, and supportive communication.'
              )
            }
          >
            <Text style={styles.statInfoText}>i</Text>
          </TouchableOpacity>
          <Text style={styles.statValue}>{homeLoading || !homeSummary.sessions ? '--' : `${homeSummary.averageScore}%`}</Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
        <View style={styles.statCard}>
          <TouchableOpacity
            style={styles.statInfoButton}
            onPress={() =>
              Alert.alert(
                'Focus Level',
                'Measures your consistency in using coaching techniques. High means you are regularly applying what you have learned.'
              )
            }
          >
            <Text style={styles.statInfoText}>i</Text>
          </TouchableOpacity>
          <Text style={styles.statValue}>{homeLoading ? '...' : homeSummary.focusLevel}</Text>
          <Text style={styles.statLabel}>Focus Level</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push('/(drawer)/coaching' as any)}
      >
        <Text style={styles.ctaButtonText}>Start Live Coaching</Text>
      </TouchableOpacity>
      <Text style={styles.ctaCaption}>Active session with real-time feedback</Text>

      <View style={styles.autoCard}>
        <View style={styles.autoText}>
          <Text style={styles.autoTitle}>{t('home_auto_start')}</Text>
          <Text style={styles.autoSubtitle}>
            {t('home_auto_start_subtitle')}
          </Text>
        </View>
        <Switch
          value={autoMonitor}
          onValueChange={handleToggleAutoMonitor}
                          trackColor={{ false: COLORS.surfaceContainerHigh, true: COLORS.primary }}
          thumbColor={COLORS.onPrimary}
        />
      </View>

      <View style={styles.inlinePrivacyNote}>
        <FontAwesome name="lock" size={14} color={COLORS.success} />
        <Text style={styles.inlinePrivacyText}>{t('home_privacy_note')}</Text>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>{'\u{1F4A1}'}</Text>
        <View style={styles.tipTextWrap}>
          <Text style={styles.tipTitle}>Tip of the Day</Text>
          <Text style={styles.tipText}>
            {DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length]}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <TouchableOpacity onPress={() => router.push('/(drawer)/history' as any)}>
          <Text style={styles.sectionLink}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionsGrid}>
        {homeLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : homeError ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionTitle}>Could not load sessions</Text>
            <Text style={styles.sessionDescription}>{homeError}</Text>
          </View>
        ) : homeReports.length === 0 ? (
          <View style={styles.sessionCard}>
            <View style={styles.sessionTopRow}>
              <Text style={styles.categoryTag}>GENERAL</Text>
              <View style={styles.scoreBadgeMuted}>
                <Text style={styles.scoreTextMuted}>--</Text>
              </View>
            </View>
            <Text style={styles.sessionTitle}>No sessions yet</Text>
            <Text style={styles.sessionTime}>Start coaching</Text>
            <Text style={styles.sessionDescription}>
              Your latest coaching summaries will appear here after analysis.
            </Text>
          </View>
        ) : (
          homeReports.slice(0, 4).map((report) => {
            const tag = getSessionTag(report.tag);
            return (
              <TouchableOpacity
                key={report.id}
                style={styles.sessionCard}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: '/(drawer)/session-results' as any,
                    params: {
                      score: report.score,
                      summary: report.summary,
                      strengths: JSON.stringify(report.strengths),
                      improvements: JSON.stringify(report.improvements),
                      tips: JSON.stringify(report.tips),
                      safetyFlag: JSON.stringify(report.safetyFlag || null),
                      reportId: report.id,
                      childName: report.childName || '',
                      sessionTag: report.tag || '',
                      durationSeconds: String(report.durationSeconds || 0),
                    },
                  })
                }
              >
                <View style={styles.sessionTopRow}>
                  <Text style={styles.categoryTag}>
                    {tag.icon} {tag.label.toUpperCase()}
                  </Text>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{report.score}</Text>
                  </View>
                </View>
                <Text style={styles.sessionTitle}>{report.childName || 'Coaching Session'}</Text>
                <Text style={styles.sessionTime}>{formatSessionDate(report.date)}</Text>
                <Text style={styles.sessionDescription} numberOfLines={2}>
                  {report.summary || 'Tap to review this coaching report.'}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  monitorBar: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 9999,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    paddingLeft: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  monitorKicker: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  monitorMeta: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  monitorButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 176,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  monitorButtonActive: {
    backgroundColor: COLORS.surfaceContainer,
  },
  monitorButtonText: {
    color: COLORS.cardBg,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  monitorButtonTextActive: {
    color: COLORS.primary,
  },
  monitorButtonTextWrap: {
    alignItems: 'center',
    gap: 2,
  },
  monitorButtonCaption: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  monitorButtonCaptionActive: {
    color: COLORS.textSecondary,
  },
  header: {
    gap: 6,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  monitorOpenCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  monitorOpenIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monitorOpenText: {
    flex: 1,
  },
  monitorOpenTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 17,
    fontWeight: '800',
  },
  monitorOpenSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  liveCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  pulseCircle: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 62,
    justifyContent: 'center',
    marginTop: 4,
  },
  waveformBar: {
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    width: 4,
  },
  liveText: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 18,
    position: 'relative',
  },
  statInfoButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
  },
  statInfoText: {
    color: COLORS.textFaint,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '800',
  },
  statValue: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  ctaButtonText: {
    color: COLORS.cardBg,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaCaption: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    marginTop: -14,
    textAlign: 'center',
  },
  autoCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  inlinePrivacyNote: {
    alignItems: 'center',
    backgroundColor: COLORS.successBg,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    marginTop: -12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlinePrivacyText: {
    color: COLORS.successText,
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  autoText: {
    flex: 1,
  },
  autoTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  autoSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 4,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
  },
  sectionLink: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonWrapper: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  skeletonCard: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
    padding: 24,
  },
  skeletonTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonTag: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 9999,
    height: 20,
    width: 100,
  },
  skeletonScore: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 9999,
    height: 20,
    width: 40,
  },
  skeletonTitle: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 6,
    height: 20,
    width: '70%',
  },
  skeletonLineFull: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 6,
    height: 14,
    width: '100%',
  },
  skeletonLineShort: {
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 6,
    height: 14,
    width: '60%',
  },
  sessionCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 178,
    padding: 14,
  },
  sessionTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryTag: {
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 9999,
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryTagMuted: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 9999,
    borderWidth: 1,
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  scoreBadgeMuted: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerHigh,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  scoreText: {
    color: COLORS.cardBg,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
  },
  scoreTextMuted: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 21,
  },
  sessionTime: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  sessionDescription: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 12,
  },
  tipCard: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  tipIcon: {
    fontSize: 24,
  },
  tipTextWrap: {
    flex: 1,
  },
  tipTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  errorCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.error,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: COLORS.error,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  successText: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
  },
});

