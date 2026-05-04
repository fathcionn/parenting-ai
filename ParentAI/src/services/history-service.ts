import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoachingReport } from '../types/analysis';
import { migrateStorageKey, STORAGE_KEYS } from './storageKeys';

const HISTORY_KEY = STORAGE_KEYS.history;

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
  }

  async deleteReport(id: string): Promise<void> {
    const history = await this.getHistory();
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.filter((item) => item.id !== id))
    );
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
