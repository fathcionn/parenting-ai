import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getAuth } from 'firebase/auth';
import { Alert, Platform } from 'react-native';
import { collection, doc, serverTimestamp, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase-config';
import type { CoachingReport } from '../types/analysis';
import { migrateStorageKey, STORAGE_KEYS } from './storageKeys';

const HISTORY_KEY = STORAGE_KEYS.history;

type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  earned: (reports: CoachingReport[]) => boolean;
};

function uniqueSessionDays(reports: CoachingReport[]) {
  return new Set(
    reports.map((report) => new Date(report.createdAt || Date.now()).toISOString().slice(0, 10))
  );
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first-step',
    title: 'First Step',
    description: 'Completed your very first coaching session.',
    earned: (reports) => reports.length >= 1,
  },
  {
    id: 'three-day-streak',
    title: '3-Day Streak',
    description: 'Completed coaching sessions on 3 different days.',
    earned: (reports) => uniqueSessionDays(reports).size >= 3,
  },
  {
    id: 'calm-voice',
    title: 'Calm Voice',
    description: 'Scored 80 or higher in a coaching session.',
    earned: (reports) => reports.some((report) => Number(report.parentingScore || 0) >= 80),
  },
  {
    id: 'role-model',
    title: 'Role Model',
    description: 'Achieved a 90+ positive communication score.',
    earned: (reports) => reports.some((report) => Number(report.parentingScore || 0) >= 90),
  },
  {
    id: 'active-listener',
    title: 'Active Listener',
    description: 'Completed 10 coaching sessions.',
    earned: (reports) => reports.length >= 10,
  },
];

async function notifyBadgeUnlocked(badge: BadgeDefinition) {
  const title = 'Achievement Unlocked';
  const body = `${badge.title}: ${badge.description}`;

  Alert.alert(title, body, [{ text: 'Nice' }]);

  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { badgeId: badge.id },
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Failed to show badge notification:', error);
  }
}

async function evaluateAndSaveAchievements(reports: CoachingReport[]) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const badgesRef = collection(db, 'users', user.uid, 'badges');
    const existingSnapshot = await getDocs(badgesRef);
    const existingEarned = new Set(existingSnapshot.docs.map((item) => item.id));
    const newlyUnlocked: BadgeDefinition[] = [];

    await Promise.all(
      BADGE_DEFINITIONS.filter((badge) => badge.earned(reports)).map(async (badge) => {
        const isNew = !existingEarned.has(badge.id);
        if (isNew) {
          newlyUnlocked.push(badge);
        }

        await setDoc(
          doc(db, 'users', user.uid, 'badges', badge.id),
          {
            id: badge.id,
            title: badge.title,
            description: badge.description,
            updatedAt: serverTimestamp(),
            ...(isNew ? { earnedAt: serverTimestamp() } : {}),
          },
          { merge: true }
        );
      })
    );

    newlyUnlocked.forEach((badge) => {
      notifyBadgeUnlocked(badge);
    });
  } catch (error) {
    console.warn('Failed to evaluate achievements:', error);
  }
}

export const saveReportToFirestore = async (reportData: {
  id: string;
  score: number;
  strengths: string[];
  improvements: string[];
  transcript?: string;
  suggestions?: string[];
  mode?: string;
  summary?: string;
  tips?: string[];
  childId?: string | null;
  childName?: string | null;
  tag?: string | null;
  analysis?: any;
  durationSeconds?: number;
  language?: string;
}) => {
  const user = getAuth().currentUser;
  if (!user) {
    console.error('No user logged in, cannot save report');
    return;
  }

  try {
    console.log('Saving report for user:', user.uid);
    await setDoc(doc(collection(db, 'users', user.uid, 'reports'), reportData.id), {
      score: reportData.score,
      strengths: reportData.strengths,
      improvements: reportData.improvements,
      summary: reportData.summary || '',
      tips: reportData.tips || reportData.suggestions || [],
      transcript: reportData.transcript || '',
      suggestions: reportData.suggestions || [],
      mode: reportData.mode || 'coaching',
      childId: reportData.childId || null,
      childName: reportData.childName || null,
      tag: reportData.tag || 'general',
      analysis: reportData.analysis || null,
      safetyFlag: null,
      durationSeconds: reportData.durationSeconds || 0,
      language: reportData.language || 'en',
      date: serverTimestamp(),
    });
    console.log('Report saved to Firestore successfully');
  } catch (error) {
    console.error('Failed to save report to Firestore:', error);
  }
};

class HistoryService {
  async getHistory(): Promise<CoachingReport[]> {
    await migrateStorageKey(HISTORY_KEY);
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveReport(report: CoachingReport): Promise<void> {
    const history = await this.getHistory();
    const nextHistory = [report, ...history.filter((item) => item.id !== report.id)];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));

    await saveReportToFirestore({
      id: report.id,
      score: report.parentingScore,
      strengths: report.strengths || report.analysis.positive_notes || [],
      improvements: report.improvements || report.analysis.detected_issues || [],
      suggestions: report.analysis.suggestions || [],
      summary: report.summary || report.analysis.impact_analysis || '',
      tips: report.tips || report.analysis.suggestions || [],
      transcript: report.transcript || '',
      mode: report.mode || 'coaching',
      childId: report.childId || null,
      childName: report.childName || null,
      tag: report.tag || 'general',
      analysis: report.analysis,
      durationSeconds: report.durationSeconds,
      language: report.language,
    });

    evaluateAndSaveAchievements(nextHistory).catch((error) => {
      console.warn('Achievement evaluation failed:', error);
    });
  }

  async deleteReport(id: string): Promise<void> {
    const history = await this.getHistory();
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.filter((item) => item.id !== id))
    );

    const user = auth.currentUser;
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reports', id));
      } catch (error) {
        console.error('Failed to delete report from Firestore:', error);
      }
    }
  }

  async getReport(id: string): Promise<CoachingReport | null> {
    const history = await this.getHistory();
    return history.find((item) => item.id === id) || null;
  }
}

export const historyService = new HistoryService();

export async function saveToHistory(entry: CoachingReport): Promise<void> {
  await historyService.saveReport(entry);
}

export async function getHistory(): Promise<CoachingReport[]> {
  return historyService.getHistory();
}
