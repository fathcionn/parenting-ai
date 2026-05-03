import { create } from 'zustand';
import type { CoachingReport } from '../types/analysis';

export type AnalysisResult = CoachingReport;

interface CoachingStore {
  isRecording: boolean;
  isAnalyzing: boolean;
  currentAnalysis: CoachingReport | null;
  analysisHistory: CoachingReport[];
  setIsRecording: (recording: boolean) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setCurrentAnalysis: (analysis: CoachingReport | null) => void;
  addToHistory: (analysis: CoachingReport) => void;
  clearHistory: () => void;
}

export const useCoachingStore = create<CoachingStore>((set) => ({
  isRecording: false,
  isAnalyzing: false,
  currentAnalysis: null,
  analysisHistory: [],
  setIsRecording: (recording) => set({ isRecording: recording }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  addToHistory: (analysis) =>
    set((state) => ({
      analysisHistory: [...state.analysisHistory, analysis],
    })),
  clearHistory: () => set({ analysisHistory: [] }),
}));
