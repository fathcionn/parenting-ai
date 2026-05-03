import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import 'react-native-reanimated';
import i18n from '../src/config/i18n';
import { auth } from '../src/config/firebase-config';
import { useAuthStore } from '../src/stores/auth-store';
import { theme } from '../src/styles/theme';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(drawer)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const { setUser } = useAuthStore();

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsInitialized(true);
    });

    return unsubscribe;
  }, [setUser]);

  useEffect(() => {
    if (loaded && isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, isInitialized]);

  if (!loaded || !isInitialized) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'fade',
          }}
        >
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
    </I18nextProvider>
  );
}
