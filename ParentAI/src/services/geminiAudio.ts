let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let micStream: MediaStream | null = null;

export async function startRecording(micDeviceId?: string): Promise<void> {
  audioChunks = [];

  const constraints: MediaStreamConstraints = {
    audio: micDeviceId && micDeviceId !== 'default'
      ? { deviceId: { exact: micDeviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  };

  micStream = await navigator.mediaDevices.getUserMedia(constraints);

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
    ? 'audio/webm'
    : 'audio/ogg';

  mediaRecorder = new MediaRecorder(micStream, { mimeType });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunks.push(event.data);
  };
  mediaRecorder.start(100);
}

export function stopRecording(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder) return reject(new Error('No recorder'));

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mediaRecorder!.mimeType });
      micStream?.getTracks().forEach((track) => track.stop());
      micStream = null;
      mediaRecorder = null;
      resolve(blob);
    };

    mediaRecorder.stop();
  });
}

export function getMicStream(): MediaStream | null {
  return micStream;
}

export async function transcribeAndAnalyze(
  audioBlob: Blob,
  language: string
): Promise<any> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  uint8Array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64Audio = btoa(binary);

  const languageNames: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
    tr: 'Turkish',
  };
  const langName = languageNames[language] || 'English';

  const response = await fetch('http://localhost:3001/api/analyze-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64: base64Audio,
      mimeType: audioBlob.type,
      language: langName,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Analysis failed');
  }

  return response.json();
}
