import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';

import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';
import trTranslations from '../locales/tr.json';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useAppStore } from '../stores/app-store';

const resources = {
  en: { translation: enTranslations },
  ar: { translation: arTranslations },
  tr: { translation: trTranslations },
};

function setDocumentLanguage(lang: string) {
  if (typeof document !== 'undefined') {
    const direction = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = lang;
    document.body.dir = direction;
    document.body.lang = lang;
  }
}

function normalizeLanguage(lang: string | null | undefined) {
  if (lang?.startsWith('ar')) return 'ar';
  if (lang?.startsWith('tr')) return 'tr';
  return 'en';
}

function applyRTL(lang: string) {
  const isRTL = lang === 'ar';
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

i18next.use(initReactI18next).init({
  resources,
  fallbackLng: 'en',
  lng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export const initLanguage = async () => {
  try {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }

    const userChoseLang = await getStorageItem(STORAGE_KEYS.languageChosen);
    const appLanguage = await AsyncStorage.getItem('app-language');
    const savedSpeechLanguage = await getStorageItem(STORAGE_KEYS.speechLanguage);
    const saved = normalizeLanguage(appLanguage || savedSpeechLanguage || 'en');

    if (!userChoseLang && !appLanguage && !savedSpeechLanguage) {
      await setStorageItem(STORAGE_KEYS.speechLanguage, 'en');
      await AsyncStorage.setItem('app-language', 'en');
      await i18next.changeLanguage('en');
      useAppStore.getState().setLanguage('en');
      setDocumentLanguage('en');
      applyRTL('en');
    } else {
      await setStorageItem(STORAGE_KEYS.speechLanguage, saved);
      await AsyncStorage.setItem('app-language', saved);
      await i18next.changeLanguage(saved);
      useAppStore.getState().setLanguage(saved);
      setDocumentLanguage(saved);
      applyRTL(saved);
    }
  } catch (e) {
    console.error('Error initializing language:', e);
  }
};

export const setLanguage = async (lang: string) => {
  try {
    const normalizedLang = normalizeLanguage(lang);
    await AsyncStorage.setItem('app-language', normalizedLang);
    await setStorageItem(STORAGE_KEYS.speechLanguage, normalizedLang);
    await setStorageItem(STORAGE_KEYS.languageChosen, 'true');
    await i18next.changeLanguage(normalizedLang);
    useAppStore.getState().setLanguage(normalizedLang);
    setDocumentLanguage(normalizedLang);
    applyRTL(normalizedLang);
  } catch (e) {
    console.error('Error setting language:', e);
  }
};

export const languageReady = initLanguage();

export default i18next;

