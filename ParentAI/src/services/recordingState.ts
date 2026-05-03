import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecordingMode = 'idle' | 'background' | 'coaching';

let currentMode: RecordingMode = 'idle';
let backgroundRecorder: any = null;
let backgroundStartedAt = 0;

export function getMode(): RecordingMode {
  return currentMode;
}

export function setMode(mode: RecordingMode) {
  currentMode = mode;
}

export function setBackgroundRecorder(recorder: any) {
  backgroundRecorder = recorder;
}

export function getBackgroundRecorder() {
  return backgroundRecorder;
}

export function setBackgroundStartedAt(startedAt: number) {
  backgroundStartedAt = startedAt;
}

export function getBackgroundStartedAt() {
  return backgroundStartedAt;
}

export async function getAutoMonitorPreference(): Promise<boolean> {
  const val = await AsyncStorage.getItem('parentai_auto_monitor');
  return val === 'true';
}

export async function setAutoMonitorPreference(val: boolean) {
  await AsyncStorage.setItem('parentai_auto_monitor', val ? 'true' : 'false');
}
