import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { colors as appColors } from '../theme/colors';
import { useAppStore } from '../stores/app-store';

const lightTheme = {
  background: appColors.light.background,
  card: appColors.light.card,
  surface: appColors.light.surface,
  surfaceHigh: appColors.light.surfaceHigh,
  input: appColors.light.input,
  primary: appColors.light.primary,
  accent: appColors.light.accent,
  text: appColors.light.text,
  muted: appColors.light.textSecondary,
  faint: appColors.light.muted,
  border: appColors.light.border,
  danger: appColors.light.danger,
  warning: appColors.light.warning,
  success: appColors.light.success,
  onPrimary: appColors.light.onPrimary,
};

const darkTheme = {
  background: appColors.dark.background,
  card: appColors.dark.card,
  surface: appColors.dark.surface,
  surfaceHigh: appColors.dark.surfaceHigh,
  input: appColors.dark.input,
  primary: appColors.dark.primary,
  accent: appColors.dark.accent,
  text: appColors.dark.text,
  muted: appColors.dark.textSecondary,
  faint: appColors.dark.muted,
  border: appColors.dark.border,
  danger: appColors.dark.danger,
  warning: appColors.dark.warning,
  success: appColors.dark.success,
  onPrimary: appColors.dark.onPrimary,
};

type ThemeContextValue = {
  isDarkMode: boolean;
  colors: typeof lightTheme;
  setDarkMode: (value: boolean) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDarkMode: false,
  colors: lightTheme,
  setDarkMode: async () => {},
  toggleDarkMode: async () => {},
});

function applyDocumentTheme(isDarkMode: boolean) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const theme = isDarkMode ? darkTheme : lightTheme;
  document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
  document.documentElement.style.backgroundColor = theme.background;
  document.body.style.backgroundColor = theme.background;
  document.body.style.color = theme.text;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const setGlobalDarkMode = useAppStore((state) => state.setDarkMode);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((value) => {
      const enabled = value === 'true';
      setIsDarkMode(enabled);
      setGlobalDarkMode(enabled);
      applyDocumentTheme(enabled);
    });
  }, [setGlobalDarkMode]);

  const setDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    setGlobalDarkMode(value);
    applyDocumentTheme(value);
    await AsyncStorage.setItem('darkMode', value ? 'true' : 'false');
  };

  const value = useMemo(
    () => ({
      isDarkMode,
      colors: isDarkMode ? darkTheme : lightTheme,
      setDarkMode,
      toggleDarkMode: () => setDarkMode(!isDarkMode),
    }),
    [isDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
