import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../config/firebase-config';
import { theme } from '../styles/theme';
import { Button } from './Button';
import { Card } from './Layout';
import { AnalysisDisplay } from './AnalysisDisplay';
import {
  getMicStream,
  startRecording,
  stopRecording,
  transcribeAndAnalyze,
} from '../services/geminiAudio';
import { getRecordingMeteringLevel } from '../services/nativeAudio';
import { saveToHistory } from '../services/history-service';
import { checkSessionSafety, notifySafetyFlag, saveSafetyFlag } from '../services/safety-service';
import { setMode } from '../services/recordingState';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import {
  calculateParentingScore,
  type CoachingReport,
  type ParentingAnalysis,
} from '../types/analysis';
import { useCoachingStore } from '../stores/coaching-store';
import { SESSION_TAGS } from '../utils/reportUtils';

interface RecordingComponentProps {
  childId?: string | null;
  title?: string;
  onReport?: (report: CoachingReport) => void;
  speechLanguage?: string;
}

type ChildOption = {
  id: string;
  name: string;
};

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

function isConnectionError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('fetch') || message.includes('network') || message.includes('server');
}

export const RecordingComponent: React.FC<RecordingComponentProps> = ({
  childId,
  title,
  onReport,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const cardTitle = title || t('coaching_session_title');
  const { currentAnalysis, setCurrentAnalysis, setIsAnalyzing } = useCoachingStore();
  const animFrameRef = useRef<number>(0);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionStartRef = useRef(0);
  const pendingAudioRef = useRef<Blob | string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(2));
  const [transcript, setTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childId || null);
  const [selectedTag, setSelectedTag] = useState('general');

  useEffect(() => {
    return () => {
      stopWaveform();
    };
  }, []);

  useEffect(() => {
    async function loadChildren() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snapshot = await getDocs(
          query(collection(db, 'users', user.uid, 'children'), orderBy('createdAt', 'desc'))
        );
        const nextChildren = snapshot.docs.map((item) => {
          const data = item.data();
          return { id: item.id, name: String(data.name || 'Child') };
        });
        setChildren(nextChildren);
        if (!selectedChildId && nextChildren[0]) {
          setSelectedChildId(nextChildren[0].id);
        }
      } catch (err) {
        console.error('Failed to load children:', err);
      }
    }
    loadChildren();
  }, [selectedChildId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((Date.now() - sessionStartRef.current) / 1000);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

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

  async function handleStart() {
    setError(null);
    setCurrentAnalysis(null);
    setTranscript('');
    setIsLoading(false);
    setIsAnalyzing(false);
    setRecordingSeconds(0);

    try {
      const lang = (await getStorageItem(STORAGE_KEYS.speechLanguage)) || 'en';
      await startRecording(undefined, lang);
      const stream = getMicStream();
      startWaveform(stream);
      sessionStartRef.current = Date.now();
      setMode('coaching');
      setIsRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError(t('error_mic_blocked'));
      } else {
        setError(`${t('error_mic_blocked')} ${err.message}`);
      }
    }
  }

  async function analyzeAudioData(audioData: Blob | string) {
    if (typeof audioData !== 'string' && audioData.size < 1000) {
      setError(t('error_no_speech'));
      return;
    }

    const lang = (await getStorageItem(STORAGE_KEYS.speechLanguage)) || 'en';
    const result = await transcribeAndAnalyze(audioData, lang);
    const normalizedAnalysis = normalizeAnalysis(result);
    const transcriptText = String(result.transcript || '');

    if (transcriptText.trim().length < 2) {
      setError(t('error_no_speech'));
      return;
    }

    const selectedChild = children.find((item) => item.id === selectedChildId) || null;
    const score = calculateParentingScore(normalizedAnalysis);
    const reportId = `report_${Date.now()}`;
    const summary = String(result.summary || normalizedAnalysis.impact_analysis || '');
    const strengths = Array.isArray(result.strengths) ? result.strengths : normalizedAnalysis.positive_notes;
    const improvements = Array.isArray(result.improvements)
      ? result.improvements
      : normalizedAnalysis.detected_issues;
    const tips = Array.isArray(result.tips) ? result.tips : normalizedAnalysis.suggestions;

    const report: CoachingReport = {
      id: reportId,
      createdAt: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 1000)),
      audioUri: typeof audioData === 'string' ? audioData : null,
      transcript: transcriptText,
      language: lang,
      mode: 'coaching',
      analysis: normalizedAnalysis,
      parentingScore: score,
      childId: selectedChild?.id || null,
      childName: selectedChild?.name || null,
      tag: selectedTag,
      summary,
      strengths,
      improvements,
      tips,
    };

    setTranscript(transcriptText);
    setCurrentAnalysis(report);
    onReport?.(report);
    await saveToHistory(report);

    let safetyFlag: any = { safe: true, severity: 'none', detected: [], recommendation: '' };
    try {
      const safety = await checkSessionSafety(transcriptText);
      safetyFlag = safety;
      if (!safety.safe) {
        await saveSafetyFlag(report.id, safety);
        await notifySafetyFlag(report.id, safety, () =>
          router.push({
            pathname: '/(drawer)/report-detail' as any,
            params: { id: report.id },
          })
        );
      }
    } catch (safetyError) {
      console.warn('Safety check failed:', safetyError);
    }

    router.push({
      pathname: '/(drawer)/session-results' as any,
      params: {
        score: String(score),
        summary,
        strengths: JSON.stringify(strengths),
        improvements: JSON.stringify(improvements),
        tips: JSON.stringify(tips),
        safetyFlag: JSON.stringify(safetyFlag),
        reportId,
        childName: selectedChild?.name || '',
        sessionTag: selectedTag || '',
      },
    });
  }

  async function retryAnalysis() {
    if (!pendingAudioRef.current) return;
    setIsLoading(true);
    setIsAnalyzing(true);
    setError(null);
    try {
      await analyzeAudioData(pendingAudioRef.current);
    } catch (err: any) {
      setError(`${t('error_analysis_failed')} ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  }

  async function handleStop() {
    setIsRecording(false);
    setMode('idle');
    stopWaveform();
    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const audioData = await stopRecording();
      pendingAudioRef.current = audioData;
      await analyzeAudioData(audioData);
    } catch (err: any) {
      if (isConnectionError(err)) {
        Alert.alert('Connection Issue', 'Could not reach the server. Please check your internet connection and try again.', [
          { text: 'Retry', onPress: () => retryAnalysis() },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        setError(`${t('error_analysis_failed')} ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  }

  return (
    <Card title={cardTitle}>
      <Text style={styles.selectorTitle}>Which child is this session for?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
        {children.length === 0 ? (
          <View style={[styles.selectorPill, styles.selectorPillActive]}>
            <Text style={styles.selectorPillTextActive}>No child linked</Text>
          </View>
        ) : (
          children.map((childOption) => {
            const isSelected = selectedChildId === childOption.id;
            return (
              <TouchableOpacity
                key={childOption.id}
                style={[styles.selectorPill, isSelected && styles.selectorPillActive]}
                onPress={() => setSelectedChildId(childOption.id)}
                activeOpacity={0.8}
              >
                <Text style={isSelected ? styles.selectorPillTextActive : styles.selectorPillText}>
                  {childOption.name}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Text style={styles.selectorTitle}>Session topic</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
        {SESSION_TAGS.map((tag) => {
          const isSelected = selectedTag === tag.id;
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: isSelected ? '#000' : tag.color }]}
              onPress={() => setSelectedTag(tag.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>
                {tag.icon} {tag.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.waveform}>
        {waveformBars.map((bar, index) => (
          <View key={index} style={[styles.waveformBar, { height: bar }]} />
        ))}
      </View>

      {isRecording ? (
        <View style={styles.recordingStatus}>
          <Text style={styles.recordingStatusText}>Recording... speak clearly</Text>
          <Text style={styles.recordingTimer}>🎙️ Recording: {recordingSeconds.toFixed(1)} seconds</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.processingStatus}>
          <Text style={styles.processingText}>Processing your session...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {transcript ? (
        <View style={styles.transcriptCard}>
          <Text style={styles.transcriptLabel}>{t('coaching_transcript')}</Text>
          <Text style={styles.transcriptText}>{transcript}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        {!isRecording ? (
          <Button
            title={isLoading ? t('coaching_analyzing') : t('coaching_start')}
            onPress={handleStart}
            variant="primary"
            size="large"
            fullWidth
            disabled={isLoading}
            loading={isLoading}
          />
        ) : (
          <Button
            title={t('coaching_stop')}
            onPress={handleStop}
            variant="outline"
            size="large"
            fullWidth
          />
        )}
      </View>

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={styles.loadingText}>
            Analyzing your session... This may take up to 30 seconds on first use.
          </Text>
        </View>
      )}

      {!isLoading && currentAnalysis && <AnalysisDisplay analysis={currentAnalysis} />}

    </Card>
  );
};

const styles = StyleSheet.create({
  selectorTitle: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  selectorScroll: {
    marginBottom: theme.spacing.md,
  },
  selectorPill: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectorPillActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  selectorPillText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  selectorPillTextActive: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tagPill: {
    borderRadius: 999,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tagText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  tagTextActive: {
    color: '#FFF',
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 72,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  waveformBar: {
    backgroundColor: '#000',
    borderRadius: 2,
    width: 4,
  },
  recordingStatus: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderColor: '#E5E5E5',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: 12,
  },
  recordingStatusText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  recordingTimer: {
    color: '#777',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  processingStatus: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: theme.spacing.md,
    padding: 12,
  },
  processingText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  controls: {
    marginTop: theme.spacing.md,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  errorText: {
    color: '#991B1B',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
    lineHeight: 20,
  },
  transcriptCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E0E0E0',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: 16,
  },
  transcriptLabel: {
    color: '#777',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  transcriptText: {
    color: '#000',
    fontSize: 15,
    lineHeight: 22,
  },
  loadingBox: {
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
    textAlign: 'center',
  },
});
