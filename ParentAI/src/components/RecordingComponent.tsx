import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { setMode } from '../services/recordingState';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import {
  calculateParentingScore,
  type CoachingReport,
  type ParentingAnalysis,
} from '../types/analysis';
import { useCoachingStore } from '../stores/coaching-store';

interface RecordingComponentProps {
  childId?: string | null;
  title?: string;
  onReport?: (report: CoachingReport) => void;
  speechLanguage?: string;
}

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

export const RecordingComponent: React.FC<RecordingComponentProps> = ({
  childId,
  title,
  onReport,
}) => {
  const { t } = useTranslation();
  const cardTitle = title || t('coaching_session_title');
  const { currentAnalysis, setCurrentAnalysis, setIsAnalyzing } = useCoachingStore();
  const animFrameRef = useRef<number>(0);
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionStartRef = useRef(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(40).fill(2));
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    return () => {
      stopWaveform();
    };
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

  async function handleStart() {
    setError(null);
    setAnalysis(null);
    setCurrentAnalysis(null);
    setTranscript('');
    setIsLoading(false);
    setIsAnalyzing(false);

    try {
      const micId = await getStorageItem(STORAGE_KEYS.micId) || 'default';
      const lang = await getStorageItem(STORAGE_KEYS.speechLanguage) || 'en';
      await startRecording(micId, lang);
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

  async function handleStop() {
    setIsRecording(false);
    setMode('idle');
    stopWaveform();
    setIsLoading(true);
    setIsAnalyzing(true);

    try {
      const audioData = await stopRecording();

      if (typeof audioData !== 'string' && audioData.size < 1000) {
        setError(t('error_no_speech'));
        setIsLoading(false);
        return;
      }

      const lang = await getStorageItem(STORAGE_KEYS.speechLanguage) || 'en';
      const result = await transcribeAndAnalyze(audioData, lang);
      const normalizedAnalysis = normalizeAnalysis(result);
      const transcriptText = String(result.transcript || '');

      if (transcriptText.trim().length < 2) {
        setError(t('error_no_speech'));
        setIsLoading(false);
        return;
      }

      setTranscript(transcriptText);
      setAnalysis(result);

      const report: CoachingReport = {
        id: `report_${Date.now()}`,
        createdAt: new Date().toISOString(),
        durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 1000)),
        audioUri: typeof audioData === 'string' ? audioData : null,
        transcript: transcriptText,
        language: lang,
        mode: 'coaching',
        analysis: normalizedAnalysis,
        parentingScore: calculateParentingScore(normalizedAnalysis),
        childId,
      };

      setCurrentAnalysis(report);
      onReport?.(report);
      await saveToHistory(report);
    } catch (err: any) {
      setError(`${t('error_analysis_failed')} ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  }

  return (
    <Card title={cardTitle}>
      <View style={styles.waveform}>
        {waveformBars.map((bar, index) => (
          <View key={index} style={[styles.waveformBar, { height: bar }]} />
        ))}
      </View>

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

      {!isLoading && currentAnalysis && (
        <AnalysisDisplay analysis={currentAnalysis} />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
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
