import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { auth, db } from '../config/firebase-config';
import {
    getMicStream,
    startRecording,
    stopRecording,
    transcribeAndAnalyze,
} from '../services/geminiAudio';
import { saveToHistory } from '../services/history-service';
import { getRecordingMeteringLevel } from '../services/nativeAudio';
import { setMode } from '../services/recordingState';
import { checkSessionSafety, notifySafetyFlag, saveSafetyFlag } from '../services/safety-service';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useCoachingStore } from '../stores/coaching-store';
import {
    calculateParentingScore,
    type CoachingReport,
    type ParentingAnalysis,
} from '../types/analysis';
import { SESSION_TAGS } from '../utils/reportUtils';
import { AnalysisDisplay } from './AnalysisDisplay';

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

function formatRecordingTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

const decorativeWaveHeights = [18, 32, 24, 46, 30, 58, 36, 48, 26, 40, 22, 34, 18, 28];

export const RecordingComponent: React.FC<RecordingComponentProps> = ({
  childId,
  onReport,
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentAnalysis, setCurrentAnalysis, setIsAnalyzing } = useCoachingStore();
  const animFrameRef = useRef<number>(0);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionStartRef = useRef(0);
  const pendingAudioRef = useRef<Blob | string | null>(null);
  const didNavigateToResultsRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(2));
  const [transcript, setTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childId || null);
  const [selectedTag, setSelectedTag] = useState('general');
  const [processingStep, setProcessingStep] = useState<'idle' | 'transcribing' | 'insights'>('idle');

  useEffect(() => {
    return () => {
      stopWaveform();
      setProcessingStep('idle');
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
    setProcessingStep('idle');

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

    try {
      console.log('STEP 3: transcription result:', 'starting');
      setProcessingStep('transcribing');
      const result = await transcribeAndAnalyze(audioData, lang);
      setProcessingStep('insights');
      console.log('STEP 4: analysis started');
      console.log('STEP 5: analysis response raw:', result);

      if (!result) {
        throw new Error('No result returned from analysis');
      }

      const normalizedAnalysis = normalizeAnalysis(result);
      const transcriptText = String(result.transcript || '');

      if (transcriptText.trim().length < 2) {
        if (!didNavigateToResultsRef.current) {
          setError(t('error_no_speech'));
        }
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

    try {
      await saveToHistory(report);
      console.log('STEP 5B: report saved');
      setError(null);
      didNavigateToResultsRef.current = true;
      console.log('STEP 6: navigating to results');
      router.push({
        pathname: '/(drawer)/session-results' as any,
        params: {
          transcript: transcriptText,
          score: String(score),
          summary,
          strengths: JSON.stringify(strengths),
          improvements: JSON.stringify(improvements),
          tips: JSON.stringify(tips),
          safetyFlag: String(result.safetyFlag ?? false),
          reportId,
          childName: selectedChild?.name || '',
          sessionTag: selectedTag || '',
          durationSeconds: String(report.durationSeconds || 0),
        },
      });
    } catch (error) {
      console.error('STEP 6 FAILED - navigation error:', error);
      Alert.alert('Navigation Error', 'Could not navigate to results. Please try again.');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
      setProcessingStep('idle');
    }

    checkSessionSafety(transcriptText)
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
      .catch((safetyError) => {
        console.warn('Safety check failed:', safetyError);
      });
    } catch (error) {
      console.error('Transcription error details:', error);
      Alert.alert(
        'Transcription Failed',
        'Could not analyze your session. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      // Clear loading on error
      setIsLoading(false);
      setIsAnalyzing(false);
      setProcessingStep('idle');
      return;
    }
  }

  async function retryAnalysis() {
    if (!pendingAudioRef.current) return;
    setIsLoading(true);
    setIsAnalyzing(true);
    setProcessingStep('transcribing');
    setError(null);
    try {
      await analyzeAudioData(pendingAudioRef.current);
    } catch (err: any) {
      setError(`${t('error_analysis_failed')} ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
      setProcessingStep('idle');
    }
  }

  async function handleStop() {
    console.log('STEP 1: recording stopped');
    didNavigateToResultsRef.current = false;
    setIsRecording(false);
    setMode('idle');
    stopWaveform();
    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const audioData = await stopRecording();
      if (audioData instanceof Blob && audioData.size < 10000) {
        Alert.alert(
          'Recording Too Short',
          'Please record for at least 5 seconds while speaking clearly.',
          [{ text: 'Try Again' }]
        );
        setIsLoading(false);
        setIsAnalyzing(false);
        setProcessingStep('idle');
        return;
      }
      console.log('STEP 2: transcription started');
      pendingAudioRef.current = audioData;
      await analyzeAudioData(audioData);
    } catch (err: any) {
      console.error('Analysis flow failed:', err);
      if (isConnectionError(err)) {
        Alert.alert('Connection Issue', 'Could not reach the server. Please check your internet connection and try again.', [
          { text: 'Retry', onPress: () => retryAnalysis() },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        setError(`${t('error_analysis_failed')} ${err.message}`);
      }
    } finally {
      console.log('STEP 7: loading false');
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  }

  const selectedChild = children.find((item) => item.id === selectedChildId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} activeOpacity={0.75}>
          <MaterialIcons name="close" size={24} color="#1B1B23" />
        </TouchableOpacity>

        <Text style={styles.title}>Live{'\n'}Coaching</Text>

        <View style={styles.childSelectorPill}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>
              {(selectedChild?.name || 'Sarah').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.childSelectorText} numberOfLines={1}>
            {selectedChild?.name || 'Sarah'} {'\uD83D\uDC76'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={18} color="#767586" />
        </View>
      </View>

      {children.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.childScroll}
          contentContainerStyle={styles.childScrollContent}
        >
          {children.map((childOption) => {
            const isSelected = selectedChildId === childOption.id;
            return (
              <TouchableOpacity
                key={childOption.id}
                style={[styles.childChip, isSelected && styles.childChipActive]}
                onPress={() => setSelectedChildId(childOption.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.childChipText, isSelected && styles.childChipTextActive]}>
                  {childOption.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagScroll}
        contentContainerStyle={styles.tagScrollContent}
      >
        {SESSION_TAGS.map((tag) => {
          const isSelected = selectedTag === tag.id;
          return (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagPill, isSelected && styles.tagPillActive]}
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

      <Text style={styles.contextText}>
        Place your device nearby. TalkWise will listen and provide guidance based on the interaction.
      </Text>

      <View style={styles.timerSection}>
        <View style={styles.timerRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.timerText}>{formatRecordingTime(recordingSeconds)}</Text>
        </View>
        <Text style={styles.timerSubtitle}>
          {isRecording ? 'RECORDING SESSION' : isLoading ? 'PROCESSING SESSION' : 'READY TO RECORD'}
        </Text>
      </View>

      <View style={styles.recordingInterface}>
        <View style={[styles.pulseRing, styles.pulseRingOuter]} />
        <View style={[styles.pulseRing, styles.pulseRingMiddle]} />
        <View style={[styles.pulseRing, styles.pulseRingInner]} />
        <TouchableOpacity
          style={[styles.micButton, isLoading && styles.micButtonDisabled]}
          onPress={isRecording ? handleStop : handleStart}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <MaterialIcons name="mic" size={52} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.waveform}>
        {decorativeWaveHeights.map((fallbackHeight, index) => {
          const liveHeight = waveformBars[index] || fallbackHeight;
          const height = isRecording ? Math.max(12, Math.min(58, liveHeight)) : fallbackHeight;
          return (
            <View
              key={index}
              style={[
                styles.waveformBar,
                index % 3 === 1 && styles.waveformBarActive,
                { height },
              ]}
            />
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.stopButton, !isRecording && styles.startButton]}
        onPress={isRecording ? handleStop : handleStart}
        activeOpacity={0.85}
        disabled={isLoading}
      >
        <MaterialIcons
          name={isRecording ? 'stop-circle' : 'play-circle-filled'}
          size={22}
          color={isRecording ? '#BA1A1A' : '#FFFFFF'}
        />
        <Text style={[styles.stopButtonText, !isRecording && styles.startButtonText]}>
          {isRecording ? 'Stop Session' : 'Start Session'}
        </Text>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.processingStatus}>
          <ActivityIndicator color="#6366F1" size="small" />
          <Text style={styles.processingText}>Processing your session...</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.processingSteps}>
          {[
            { id: 'done', label: 'Recording complete' },
            { id: 'transcribing', label: 'Transcribing audio' },
            { id: 'insights', label: 'Generating insights' },
          ].map((step, index) => {
            const done =
              step.id === 'done' ||
              (step.id === 'transcribing' && processingStep === 'insights');
            const active =
              (step.id === 'transcribing' && processingStep === 'transcribing') ||
              (step.id === 'insights' && processingStep === 'insights');
            return (
              <View key={step.id} style={styles.processingStepRow}>
                <View style={[styles.processingStepIcon, done && styles.processingStepDone]}>
                  {done ? (
                    <MaterialIcons name="check" size={16} color="#FFFFFF" />
                  ) : active ? (
                    <ActivityIndicator color="#6366F1" size="small" />
                  ) : (
                    <Text style={styles.processingStepNumber}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[styles.processingStepText, active && styles.processingStepTextActive]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
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

      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#6366F1" size="large" />
          <Text style={styles.loadingText}>
            Analyzing your session... This may take up to 30 seconds on first use.
          </Text>
        </View>
      )}

      {!isLoading && currentAnalysis && (
        <View style={styles.analysisWrap}>
          <AnalysisDisplay analysis={currentAnalysis} />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF8FF',
  },
  content: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 800,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
    width: '100%',
  },
  header: {
    width: '100%',
    maxWidth: 720,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    flex: 1,
    color: '#4F46E5',
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  childSelectorPill: {
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 10,
  },
  childAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
  },
  childAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  childSelectorText: {
    flexShrink: 1,
    color: '#1B1B23',
    fontSize: 13,
    fontWeight: '700',
  },
  childScroll: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 12,
  },
  childScrollContent: {
    gap: 10,
    paddingRight: 20,
  },
  childChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  childChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  childChipText: {
    color: '#1B1B23',
    fontSize: 13,
    fontWeight: '700',
  },
  childChipTextActive: {
    color: '#FFFFFF',
  },
  tagScroll: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 22,
  },
  tagScrollContent: {
    alignItems: 'center',
    gap: 10,
    paddingRight: 20,
  },
  tagPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  tagPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  tagText: {
    color: '#1B1B23',
    fontSize: 14,
    fontWeight: '700',
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  contextText: {
    maxWidth: 430,
    color: '#464554',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 26,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#BA1A1A',
  },
  timerText: {
    color: '#1B1B23',
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  timerSubtitle: {
    marginTop: 4,
    color: '#767586',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  recordingInterface: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.12)',
    backgroundColor: 'rgba(186, 26, 26, 0.10)',
  },
  pulseRingOuter: {
    width: 240,
    height: 240,
    opacity: 0.42,
  },
  pulseRingMiddle: {
    width: 190,
    height: 190,
    opacity: 0.68,
  },
  pulseRingInner: {
    width: 142,
    height: 142,
    opacity: 0.92,
  },
  micButton: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BA1A1A',
    shadowColor: '#BA1A1A',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 34px rgba(186, 26, 26, 0.28)',
      } as any,
    }),
  },
  micButtonDisabled: {
    opacity: 0.72,
  },
  waveform: {
    width: '100%',
    maxWidth: 360,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 22,
  },
  waveformBar: {
    width: 8,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
  },
  waveformBarActive: {
    backgroundColor: '#BA1A1A',
  },
  stopButton: {
    width: '100%',
    maxWidth: 400,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0px 10px 22px rgba(17, 24, 39, 0.08)',
      } as any,
    }),
  },
  startButton: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 32px rgba(124, 58, 237, 0.26)',
      } as any,
    }),
  },
  stopButtonText: {
    color: '#BA1A1A',
    fontSize: 16,
    fontWeight: '800',
  },
  startButtonText: {
    color: '#FFFFFF',
  },
  processingStatus: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  processingText: {
    color: '#464554',
    fontSize: 14,
    fontWeight: '700',
  },
  processingSteps: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  processingStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  processingStepIcon: {
    alignItems: 'center',
    backgroundColor: '#E4E1ED',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  processingStepDone: {
    backgroundColor: '#16A34A',
  },
  processingStepNumber: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '900',
  },
  processingStepText: {
    color: '#767586',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  processingStepTextActive: {
    color: '#1B1B23',
    fontWeight: '900',
  },
  errorBox: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FDECEC',
    borderColor: '#BA1A1A',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 14,
  },
  errorText: {
    color: '#BA1A1A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  transcriptCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  transcriptLabel: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  transcriptText: {
    color: '#1B1B23',
    fontSize: 15,
    lineHeight: 23,
  },
  loadingBox: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  loadingText: {
    color: '#464554',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  analysisWrap: {
    width: '100%',
    maxWidth: 560,
    marginTop: 12,
  },
});
