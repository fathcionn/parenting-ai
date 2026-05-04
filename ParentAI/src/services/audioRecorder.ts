// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
import { Platform } from 'react-native';

export type RecordingHandle = any;
export type AudioSource = Blob | string;

interface StartOptions {
  onAmplitude?: (amplitude: number) => void;
}

let mediaRecorder: MediaRecorder | null = null;
let webAudioChunks: Blob[] = [];
let webStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animationFrameId: number | null = null;
let webStartedAt = 0;

function normalizeNativeMetering(metering?: number) {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return 0;
  return Math.max(0, Math.min(1, (metering + 60) / 60));
}

function startWebAmplitudeMeter(stream: MediaStream, onAmplitude?: (amplitude: number) => void) {
  if (!onAmplitude) return;

  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return;

  audioContext = new AudioContextCtor();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    if (!analyser) return;
    analyser.getByteTimeDomainData(data);

    let sum = 0;
    for (const value of data) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }

    onAmplitude(Math.min(1, Math.sqrt(sum / data.length) * 4));
    animationFrameId = requestAnimationFrame(tick);
  };

  tick();
}

function stopWebTracks() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (webStream) {
    webStream.getTracks().forEach((track) => track.stop());
    webStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  analyser = null;
}

export async function startRecording(options: StartOptions = {}): Promise<RecordingHandle> {
  if (Platform.OS === 'web') {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        sampleSize: 16,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    webStream = stream;
    webAudioChunks = [];
    webStartedAt = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        webAudioChunks.push(event.data);
      }
    };
    mediaRecorder.start();
    startWebAmplitudeMeter(stream, options.onAmplitude);
    return null;
  }

  const { Audio } = await import('expo-av');
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission is required before recording.');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    },
    (status) => {
      options.onAmplitude?.(normalizeNativeMetering(status.metering));
    },
    80
  );

  return recording;
}

export async function stopRecording(recording: RecordingHandle): Promise<AudioSource> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('No active web recording found.'));
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(webAudioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        stopWebTracks();
        mediaRecorder = null;
        webAudioChunks = [];
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }

  if (!recording) {
    throw new Error('No active native recording found.');
  }

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  if (!uri) {
    throw new Error('Recording URI is null.');
  }

  return uri;
}

export function getRecordingDurationSeconds(startedAt: number) {
  if (Platform.OS === 'web' && webStartedAt) {
    return Math.max(0, Math.round((Date.now() - webStartedAt) / 1000));
  }
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}
