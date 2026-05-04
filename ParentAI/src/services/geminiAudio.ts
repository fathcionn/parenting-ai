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

export async function startRecording(micDeviceId?: string): Promise<void> {
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

  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: micDeviceId && micDeviceId !== 'default'
        ? {
            deviceId: { exact: micDeviceId },
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

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
    ? 'audio/ogg;codecs=opus'
    : '';

  mediaRecorder = mimeType
    ? new MediaRecorder(micStream, { mimeType })
    : new MediaRecorder(micStream);
  console.log('Using MIME type:', mimeType || 'browser default');
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

  const languageNames: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
    tr: 'Turkish',
  };
  const langName = languageNames[language] || 'English';

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
