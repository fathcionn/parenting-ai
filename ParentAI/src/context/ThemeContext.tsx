import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COLORS } from '../theme/colors';
import { useAppStore } from '../stores/app-store';

const lightTheme = {
  background: COLORS.background,
  card: COLORS.cardBg,
  text: COLORS.textPrimary,
  muted: COLORS.textSecondary,
  border: COLORS.border,
};

const darkTheme = {
  background: '#171022',
  card: '#241733',
  text: '#F8F5FF',
  muted: '#D8CDF2',
  border: '#4B3768',
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
  const setGlobalDarkMode = useAppStore((state) => state.setDarkMode);

  useEffect(() => {
    AsyncStorage.getItem('darkMode').then((value) => {
      const enabled = value === 'true';
      setIsDarkMode(enabled);
      setGlobalDarkMode(enabled);
    });
  }, [setGlobalDarkMode]);

  const setDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    setGlobalDarkMode(value);
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
