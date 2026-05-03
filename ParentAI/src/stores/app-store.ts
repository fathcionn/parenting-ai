import { create } from 'zustand';
import type { ChildProfile, DailyReport } from '../types';
import { MOCK_CHILDREN } from '../data/mock-data';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // Children
  children: ChildProfile[];
  selectedChildId: string | null;

  // Reports
  reports: DailyReport[];

  // Coaching
  coachingEnabled: boolean;

  // Actions
  login: () => void;
  logout: () => void;
  completeOnboarding: () => void;
  addChild: (child: ChildProfile) => void;
  removeChild: (id: string) => void;
  selectChild: (id: string | null) => void;
  toggleCoaching: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: true, // Default to true for demo
  hasCompletedOnboarding: true,

  children: MOCK_CHILDREN,
  selectedChildId: MOCK_CHILDREN[0]?.id || null,

  reports: [],

  coachingEnabled: false,

  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

  addChild: (child) =>
    set((state) => ({ children: [...state.children, child] })),

  removeChild: (id) =>
    set((state) => ({
      children: state.children.filter((c) => c.id !== id),
      selectedChildId: state.selectedChildId === id ? null : state.selectedChildId,
    })),

  selectChild: (id) => set({ selectedChildId: id }),
  toggleCoaching: () => set((state) => ({ coachingEnabled: !state.coachingEnabled })),
}));
