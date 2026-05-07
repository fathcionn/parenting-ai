import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COLORS } from '../theme/colors';

const lightTheme = {
  background: COLORS.background,
  card: COLORS.cardBg,
  text: COLORS.textPrimary,
  muted: COLORS.textSecondary,
  border: COLORS.border,
};

const darkTheme = {
  background: COLORS.primaryDark,
  card: COLORS.primary,
  text: COLORS.onPrimary,
  muted: COLORS.surfaceContainerHigh,
  border: COLORS.borderStrong,
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((value) => {
      setIsDarkMode(value === 'true');
    });
  }, []);

  const setDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
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
