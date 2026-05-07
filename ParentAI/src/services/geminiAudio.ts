import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/api';
import {
    audioFileToBase64,
    startNativeRecording,
    stopNativeRecording,
} from './nativeAudio';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let micStream: MediaStream | null = null;

export async function startRecording(micDeviceId?: string, language = 'en'): Promise<void> {
  if (Platform.OS !== 'web') {
    return startNativeRecording();
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.ondataavailable = null;
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  audioChunks = [];

  const savedMicId = micDeviceId || (await AsyncStorage.getItem('selectedMicId'));

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: savedMicId && savedMicId !== 'default'
        ? {
            deviceId: { exact: savedMicId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
    });
  } catch (err) {
    console.error('Microphone access error:', err);
    throw new Error('Microphone permission denied or not available');
  }

  const getMimeType = () => {
    const types = [
      'audio/wav',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Using MIME type:', type);
        return type;
      }
    }
    return 'audio/webm';
  };

  const mimeType = getMimeType();

  mediaRecorder = new MediaRecorder(micStream, { mimeType });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };
  mediaRecorder.start(100);
}

export function stopRecording(): Promise<Blob | string> {
  if (Platform.OS !== 'web') {
    return stopNativeRecording();
  }

  return new Promise((resolve, reject) => {
    if (!mediaRecorder) return reject(new Error('No recorder'));

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder!.mimeType });
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      console.log('Audio chunks count:', audioChunks.length);
      console.log('Blob type:', audioBlob.type);
      micStream?.getTracks().forEach((track) => track.stop());
      micStream = null;
      mediaRecorder = null;
      resolve(audioBlob);
    };

    mediaRecorder.stop();
  });
}

export function getMicStream(): MediaStream | null {
  return micStream;
}

export async function transcribeAndAnalyze(
  audioData: Blob | string,
  language: string
): Promise<any> {
  const languageNames: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
    tr: 'Turkish',
  };
  const langName = languageNames[language] || 'English';

  if (Platform.OS === 'web' && audioData instanceof Blob) {
    // For web, call /api/transcribe which now returns full analysis
    const result = await transcribeAudio(audioData);
    return result;
  }

  if (Platform.OS === 'web') {
    // This shouldn't happen now, but keep for compatibility
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: audioData,
        language,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Analysis failed');
    }

    return response.json();
  }

  // Mobile: use /api/analyze-audio
  let base64Audio: string;
  let mimeType: string;

  if (typeof audioData === 'string') {
    base64Audio = await audioFileToBase64(audioData);
    mimeType = 'audio/m4a';
  } else {
    const arrayBuffer = await audioData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    uint8Array.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    base64Audio = btoa(binary);
    mimeType = audioData.type || 'audio/webm';
  }

  const response = await fetch(`${API_BASE_URL}/api/analyze-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio: base64Audio,
      audioBase64: base64Audio,
      mimeType,
      lang: language,
      language: langName,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Analysis failed');
  }

  return response.json();
}

export const transcribeAudio = async (audioBlob: Blob): Promise<any> => {
  const mimeType = audioBlob.type || 'audio/webm';
  const extension = mimeType.includes('wav') ? 'wav'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('ogg') ? 'ogg'
    : 'webm';

  const formData = new FormData();
  formData.append('audio', audioBlob, `recording.${extension}`);

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Transcribe API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`Transcription failed: ${errorText}`);
  }

  const data = await response.json();
  return data; // Now returns full analysis object
};
