import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

let recording: Audio.Recording | null = null;

export async function startNativeRecording(): Promise<void> {
  try {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission denied');

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = newRecording;
  } catch (err) {
    console.error('Start recording error:', err);
    throw err;
  }
}

export async function stopNativeRecording(): Promise<string> {
  if (!recording) throw new Error('No active recording');

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  if (!uri) throw new Error('No recording URI');
  return uri;
}

export async function getRecordingMeteringLevel(): Promise<number> {
  if (!recording) return 0;
  const status = await recording.getStatusAsync();
  if (status.isRecording && status.metering !== undefined) {
    return Math.max(0, (status.metering + 160) / 160);
  }
  return 0;
}

export async function audioFileToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}
