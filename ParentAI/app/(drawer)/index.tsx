import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/auth-store';
import { HomeScreen } from '../../src/screens/HomeScreen';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user]);

  if (!user) return null;

  return <HomeScreen />;
}
