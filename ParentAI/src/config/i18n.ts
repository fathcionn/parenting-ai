import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';
import trTranslations from '../locales/tr.json';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';

const resources = {
  en: { translation: enTranslations },
  ar: { translation: arTranslations },
  tr: { translation: trTranslations },
};

function setDocumentLanguage(lang: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
}

// Initialize without waiting for async storage, we update it right after
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

    if (!userChoseLang) {
      await setStorageItem(STORAGE_KEYS.speechLanguage, 'en');
      await i18next.changeLanguage('en');
      setDocumentLanguage('en');
      if (typeof I18nManager !== 'undefined') I18nManager.forceRTL(false);
    } else {
      const saved = await getStorageItem(STORAGE_KEYS.speechLanguage) || 'en';
      await i18next.changeLanguage(saved);
      setDocumentLanguage(saved);
      if (typeof I18nManager !== 'undefined') I18nManager.forceRTL(saved === 'ar');
    }
  } catch (e) {
    console.error('Error initializing language:', e);
  }
};

export const setLanguage = async (lang: string) => {
  try {
    await AsyncStorage.setItem('app-language', lang);
    await setStorageItem(STORAGE_KEYS.speechLanguage, lang);
    await setStorageItem(STORAGE_KEYS.languageChosen, 'true');
    setDocumentLanguage(lang);
    const isRTL = lang === 'ar';
    
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      Updates.reloadAsync();
    } else {
      await i18next.changeLanguage(lang);
    }
  } catch (e) {
    console.error('Error setting language:', e);
  }
};

// Start initialization
initLanguage();

export default i18next;

