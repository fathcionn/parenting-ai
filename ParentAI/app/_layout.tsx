import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import 'react-native-reanimated';
import i18n, { languageReady } from '../src/config/i18n';
import { auth, db } from '../src/config/firebase-config';
import { useAuthStore } from '../src/stores/auth-store';
import { ThemeProvider, useAppTheme } from '../src/context/ThemeContext';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(drawer)',
};

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(userId: string) {
  if (Platform.OS === 'web') {
    console.log('Push notifications skipped on web');
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const token = await Notifications.getExpoPushTokenAsync();
    await setDoc(
      doc(db, 'users', userId),
      { pushToken: token.data },
      { merge: true }
    );
  } catch (error) {
    console.warn('Push notification registration failed:', error);
  }
}

function RootStack() {
  const appTheme = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: appTheme.colors.background }}>
      <StatusBar style={appTheme.isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: appTheme.colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="history/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="signup" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [languageInitialized, setLanguageInitialized] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        registerForPushNotifications(user.uid);
      }
      setIsInitialized(true);
    });

    return unsubscribe;
  }, [setUser]);

  useEffect(() => {
    let mounted = true;
    languageReady.finally(() => {
      if (mounted) setLanguageInitialized(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loaded && isInitialized && languageInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isInitialized, languageInitialized]);

  useEffect(() => {
    if (!loaded || !isInitialized || !languageInitialized || onboardingChecked) return;
    AsyncStorage.getItem('onboardingComplete').then((value) => {
      setOnboardingChecked(true);
      if (!value && String(segments[0]) !== 'onboarding') {
        router.replace('/onboarding' as any);
      }
    });
  }, [isInitialized, languageInitialized, loaded, onboardingChecked, router, segments]);

  useEffect(() => {
    if (!loaded || !isInitialized || !languageInitialized || !onboardingChecked) return;

    const firstSegment = String(segments[0] || '');
    const isAuthRoute = firstSegment === 'login' || firstSegment === 'signup';
    const isPublicRoute = isAuthRoute || firstSegment === 'onboarding';
    const isProtectedRoute = !isPublicRoute;

    if (!user && isProtectedRoute) {
      router.replace('/login');
      return;
    }

    if (user && isAuthRoute) {
      router.replace('/(drawer)' as any);
    }
  }, [isInitialized, languageInitialized, loaded, onboardingChecked, router, segments, user]);

  if (!loaded || !isInitialized || !languageInitialized) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <RootStack />
      </ThemeProvider>
    </I18nextProvider>
  );
}
