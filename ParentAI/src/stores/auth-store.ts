import { create } from 'zustand';
import { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  children: ChildProfile[];
  parentingScore: number;
  isAnonymous: boolean;
  language: 'en' | 'ar' | 'tr';
  createdAt: Date;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  createdAt: Date;
}

interface AuthStore {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  profile: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),
  logout: () => set({ user: null, profile: null }),
}));
