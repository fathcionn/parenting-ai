import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const lightTheme = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#000000',
  muted: '#777777',
  border: '#E5E5E5',
};

const darkTheme = {
  background: '#1a1a2e',
  card: '#16213e',
  text: '#FFFFFF',
  muted: '#C7C7D5',
  border: '#2E3A59',
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
