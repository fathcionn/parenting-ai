import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { API_BASE_URL } from '../config/api';
import { auth, db } from '../config/firebase-config';

export type SafetyFlag = {
  safe: boolean;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  detected: string[];
  recommendation: string;
};

export async function checkSessionSafety(transcript: string): Promise<SafetyFlag> {
  const response = await fetch(`${API_BASE_URL}/api/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error('Safety check failed');
  }

  return response.json();
}

export async function saveSafetyFlag(reportId: string, safety: SafetyFlag) {
  const user = auth.currentUser;
  if (!user || safety.safe) return;

  await updateDoc(doc(db, 'users', user.uid, 'reports', reportId), {
    safetyFlag: {
      severity: safety.severity,
      detected: safety.detected,
      recommendation: safety.recommendation,
    },
  });
}

export async function notifySafetyFlag(
  reportId: string,
  safety: SafetyFlag,
  onViewReport: () => void
) {
  if (safety.safe || !['moderate', 'severe'].includes(safety.severity)) return;

  Alert.alert(
    '⚠️ Session Review Recommended',
    'Our AI detected some communication patterns that may need attention. Please review your session.',
    [{ text: 'View Report', onPress: onViewReport }]
  );

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ TalkWise Safety Alert',
        body: 'A session was flagged for review. Tap to see details.',
        data: { screen: 'history', reportId },
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Failed to schedule safety notification:', error);
  }
}
