import React, { useEffect, useState } from 'react';
import {
  I18nManager,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

type SpeechLanguage = 'en' | 'ar' | 'tr';

const languages = [
  {
    code: 'en',
    label: 'English',
    flagUrl: 'https://flagcdn.com/w40/us.png',
    flag: '🇺🇸',
  },
  {
    code: 'ar',
    label: 'العربية',
    flagUrl: 'https://flagcdn.com/w40/sa.png',
    flag: '🇸🇦',
  },
  {
    code: 'tr',
    label: 'Türkçe',
    flagUrl: 'https://flagcdn.com/w40/tr.png',
    flag: '🇹🇷',
  },
];

function normalizeLanguage(language: string | undefined): SpeechLanguage {
  if (language?.startsWith('ar')) return 'ar';
  if (language?.startsWith('tr')) return 'tr';
  return 'en';
}

function setDocumentLanguage(langCode: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = langCode;
  }
}

export function HeaderLanguageButton() {
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SpeechLanguage>(
    normalizeLanguage(i18n.language)
  );

  useEffect(() => {
    AsyncStorage.getItem('parentai_speech_language').then((savedLang) => {
      const lang = normalizeLanguage(savedLang || i18n.language);
      setSelectedLanguage(lang);
      setDocumentLanguage(lang);
    });
  }, [i18n.language]);

  const selectLanguage = async (langCode: SpeechLanguage) => {
    setSelectedLanguage(langCode);
    await AsyncStorage.setItem('parentai_speech_language', langCode);
    await AsyncStorage.setItem('parentai_lang_user_chosen', 'true');
    await AsyncStorage.setItem('app-language', langCode);
    await i18n.changeLanguage(langCode);
    setDocumentLanguage(langCode);
    I18nManager.forceRTL(langCode === 'ar');
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t('lang_change')}
        activeOpacity={0.75}
        onPress={() => setModalVisible(true)}
        style={styles.globeButton}
      >
        <Text style={styles.globeText}>{'\u{1F310}'}</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('lang_select')}</Text>
            {languages.map(({ code, label, flagUrl }) => {
              const isSelected = selectedLanguage === code;
              return (
                <TouchableOpacity
                  key={code}
                  activeOpacity={0.78}
                  onPress={() => selectLanguage(code as SpeechLanguage)}
                  style={[styles.languageRow, isSelected && styles.languageRowSelected]}
                >
                  <Image
                    source={{ uri: flagUrl }}
                    style={styles.languageFlag}
                    resizeMode="cover"
                  />
                  <Text style={[styles.languageText, isSelected && styles.languageTextSelected]}>
                    {label}
                  </Text>
                  {isSelected && <Text style={styles.languageCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  globeButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginRight: 14,
    width: 40,
  },
  globeText: {
    fontSize: 22,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxWidth: 360,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  languageRow: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 14,
  },
  languageRowSelected: {
    backgroundColor: '#000000',
  },
  languageFlag: {
    borderRadius: 3,
    height: 22,
    marginRight: 14,
    width: 32,
  },
  languageText: {
    color: '#000000',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  languageTextSelected: {
    color: '#FFFFFF',
  },
  languageCheck: {
    color: '#fff',
    fontSize: 18,
  },
});
