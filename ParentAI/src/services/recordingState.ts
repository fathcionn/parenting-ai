// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
import { getStorageItem, setStorageItem, STORAGE_KEYS } from './storageKeys';

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
  const val = await getStorageItem(STORAGE_KEYS.autoMonitor);
  return val === 'true';
}

export async function setAutoMonitorPreference(val: boolean) {
  await setStorageItem(STORAGE_KEYS.autoMonitor, val ? 'true' : 'false');
}
