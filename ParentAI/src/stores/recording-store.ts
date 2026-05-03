import { create } from 'zustand';
import type { RecordingSession } from '../types';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentSession: RecordingSession | null;
  elapsedSeconds: number;
  volumeLevel: number; // 0-1
  recordingMode: 'manual' | 'auto' | 'continuous';

  // Actions
  startRecording: (childId?: string) => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  setVolumeLevel: (level: number) => void;
  setRecordingMode: (mode: 'manual' | 'auto' | 'continuous') => void;
  incrementElapsed: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  currentSession: null,
  elapsedSeconds: 0,
  volumeLevel: 0,
  recordingMode: 'manual',

  startRecording: (childId?: string) => {
    const session: RecordingSession = {
      id: `session_${Date.now()}`,
      startTime: new Date(),
      duration: 0,
      status: 'recording',
      childId,
      recordingMode: get().recordingMode,
    };
    set({
      isRecording: true,
      isPaused: false,
      currentSession: session,
      elapsedSeconds: 0,
    });
  },

  stopRecording: () => {
    const session = get().currentSession;
    if (session) {
      set({
        isRecording: false,
        isPaused: false,
        currentSession: {
          ...session,
          endTime: new Date(),
          duration: get().elapsedSeconds,
          status: 'complete',
        },
        elapsedSeconds: 0,
        volumeLevel: 0,
      });
    }
  },

  pauseRecording: () => set({ isPaused: true }),
  resumeRecording: () => set({ isPaused: false }),
  setVolumeLevel: (level: number) => set({ volumeLevel: level }),
  setRecordingMode: (mode) => set({ recordingMode: mode }),
  incrementElapsed: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
}));
