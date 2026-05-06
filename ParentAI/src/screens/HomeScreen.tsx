import React, { useEffect, useRef, useState } from 'react';
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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getMicStream,
  startRecording,
  stopRecording,
  transcribeAndAnalyze,
} from '../services/geminiAudio';
import { getRecordingMeteringLevel } from '../services/nativeAudio';
import { saveToHistory } from '../services/history-service';
import { checkSessionSafety, notifySafetyFlag, saveSafetyFlag } from '../services/safety-service';
import {
  getAutoMonitorPreference,
  setAutoMonitorPreference,
  setMode,
} from '../services/recordingState';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { calculateParentingScore, type ParentingAnalysis } from '../types/analysis';

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

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const startedAtRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasAutoStarted = useRef(false);
  const animFrameRef = useRef<number>(0);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pendingAudioRef = useRef<Blob | string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(2));
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
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
      <View style={styles.statusCard}>
        <View style={styles.iconArea}>
          {isMonitoring ? (
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.pulseDot} />
            </Animated.View>
          ) : (
            <View style={styles.inactiveIcon}>
              <FontAwesome name="microphone" size={44} color="#8A8A8A" />
            </View>
          )}
        </View>

        <Text style={styles.statusLabel}>
          {isMonitoring ? t('home_monitor_on') : t('home_monitor_off')}
        </Text>
        <Text style={styles.subtitle}>
          {isMonitoring
            ? t('home_subtitle_on')
            : t('home_subtitle_off')}
        </Text>
        {isMonitoring && <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>}
        {isMonitoring && (
          <View style={styles.waveform}>
            {waveformBars.map((bar, index) => (
              <View key={index} style={[styles.waveformBar, { height: bar }]} />
            ))}
          </View>
        )}
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

      <TouchableOpacity
        style={[styles.mainButton, isMonitoring && styles.mainButtonActive]}
        activeOpacity={0.85}
        onPress={isMonitoring ? stopAndAnalyzeMonitor : startMonitor}
        disabled={isLoading}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={isMonitoring ? '#000' : '#FFF'} />
            <Text style={[styles.mainButtonText, isMonitoring && styles.mainButtonTextActive]}>
              Analyzing your session... This may take up to 30 seconds on first use.
            </Text>
          </View>
        ) : (
          <Text style={[styles.mainButtonText, isMonitoring && styles.mainButtonTextActive]}>
            {isMonitoring ? t('home_stop_analyze') : t('home_start_monitor')}
          </Text>
        )}
      </TouchableOpacity>

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
          trackColor={{ false: '#DADADA', true: '#111111' }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
        <Text style={styles.infoText}>
          {t('home_privacy_note')}
        </Text>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <View style={styles.tipTextWrap}>
          <Text style={styles.tipTitle}>Tip of the Day</Text>
          <Text style={styles.tipText}>
            {DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length]}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 3,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  iconArea: {
    alignItems: 'center',
    height: 112,
    justifyContent: 'center',
    marginBottom: 12,
    width: 112,
  },
  inactiveIcon: {
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderRadius: 56,
    height: 112,
    justifyContent: 'center',
    width: 112,
  },
  pulseCircle: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 56,
    height: 112,
    justifyContent: 'center',
    width: 112,
  },
  pulseDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  statusLabel: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#777777',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  timer: {
    color: '#000000',
    fontFamily: 'SpaceMono',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 22,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 72,
    justifyContent: 'center',
    marginTop: 16,
  },
  waveformBar: {
    backgroundColor: '#000',
    borderRadius: 2,
    width: 4,
  },
  mainButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderColor: '#000000',
    borderRadius: 14,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
  },
  mainButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  mainButtonTextActive: {
    color: '#000000',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  autoCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  autoText: {
    flex: 1,
  },
  autoTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  autoSubtitle: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  infoCard: {
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  lockIcon: {
    fontSize: 20,
  },
  infoText: {
    color: '#555555',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  tipCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE68A',
    borderRadius: 14,
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
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  tipText: {
    color: '#3F3F00',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 14,
  },
  successText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
