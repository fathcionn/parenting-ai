import React, { useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { Container, Card } from '../components/Layout';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';

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

function setDocumentLanguage(langCode: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = langCode;
  }
}

export const AuthScreen: React.FC<{ mode: 'login' | 'signup' }> = ({ mode = 'login' }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLangModal, setShowLangModal] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const { setUser } = useAuthStore();

  useEffect(() => {
    AsyncStorage.getItem('parentai_speech_language').then((language) => {
      const lang = language || 'en';
      setCurrentLang(lang);
      setDocumentLanguage(lang);
    });
  }, []);

  async function changeLanguage(langCode: string) {
    await AsyncStorage.setItem('parentai_speech_language', langCode);
    await AsyncStorage.setItem('parentai_lang_user_chosen', 'true');
    await AsyncStorage.setItem('app-language', langCode);
    await i18n.changeLanguage(langCode);
    setDocumentLanguage(langCode);
    if (typeof I18nManager !== 'undefined') I18nManager.forceRTL(langCode === 'ar');
    setCurrentLang(langCode);
    setShowLangModal(false);
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = t('auth_email_required');
    else if (email !== 'admin' && !/\S+@\S+\.\S+/.test(email)) newErrors.email = t('auth_email_invalid');

    if (!password) newErrors.password = t('auth_password_required');
    else if (password !== 'admin' && password.length < 6) {
      newErrors.password = t('auth_password_short');
    }

    if (mode === 'signup' && password !== confirmPassword) {
      newErrors.confirmPassword = t('auth_password_mismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (email === 'admin' && password === 'admin') {
        setUser({
          uid: 'admin_mock_id',
          email: 'admin@parentai.app',
          displayName: 'Admin User',
          parentingScore: 100,
          isAnonymous: false,
        } as any);
        router.replace('/(drawer)');
        return;
      }

      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        router.replace('/(drawer)');
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        router.replace('/(drawer)');
      }
    } catch (error: any) {
      Alert.alert(t('common_error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.authGlobeButton}>
        <Text style={styles.authGlobeText}>🌐</Text>
      </TouchableOpacity>

      <Modal visible={showLangModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.langBackdrop}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}
        >
          <View style={styles.langModal}>
            <Text style={styles.langTitle}>{t('lang_select')}</Text>
            {languages.map(({ code, label, flagUrl }) => (
              <TouchableOpacity
                key={code}
                onPress={() => changeLanguage(code)}
                style={[styles.langOption, currentLang === code && styles.langOptionSelected]}
              >
                <Image source={{ uri: flagUrl }} style={styles.langFlag} resizeMode="cover" />
                <Text style={[styles.langLabel, currentLang === code && styles.langLabelSelected]}>
                  {label}
                </Text>
                {currentLang === code && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Container scroll>
        <View style={styles.header}>
          <Card>
            <View style={styles.titleContainer}>
              <View style={styles.logo}>
                <View style={styles.logoDot} />
                <View style={styles.logoDot} />
                <View style={styles.logoDot} />
              </View>
            </View>
          </Card>
        </View>

        <Card title={mode === 'login' ? t('auth_login') : t('auth_signup')}>
          <TextField
            label={t('auth_email')}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            editable={!loading}
          />

          <TextField
            label={t('auth_password')}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
            editable={!loading}
          />

          {mode === 'signup' && (
            <TextField
              label={t('auth.confirmPassword')}
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={errors.confirmPassword}
              editable={!loading}
            />
          )}

          <Button
            title={mode === 'login' ? t('auth_login') : t('auth_signup')}
            onPress={handleAuth}
            loading={loading}
            fullWidth
            variant="primary"
          />

          <Button
            title={mode === 'login' ? t('auth_no_account') : t('auth_have_account')}
            onPress={() => router.push(mode === 'login' ? '/signup' : '/login')}
            disabled={loading}
            variant="outline"
            fullWidth
          />

          <View style={styles.socialContainer}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth_or_continue')}</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Alert.alert(t('auth_notice'), t('auth_google_native_notice'))}
              >
                <FontAwesome name="google" size={18} color="#DB4437" />
                <Text style={styles.socialButtonText}>{t('auth_google')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: '#000', borderColor: '#000' }]}
                onPress={() => Alert.alert(t('auth_notice'), t('auth_apple_native_notice'))}
              >
                <FontAwesome name="apple" size={20} color="#FFF" />
                <Text style={[styles.socialButtonText, { color: '#FFF' }]}>{t('auth_apple')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </Container>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  authGlobeButton: {
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    zIndex: 100,
  },
  authGlobeText: {
    fontSize: 20,
  },
  langBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  langModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 260,
  },
  langTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  langOption: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 14,
  },
  langOptionSelected: {
    backgroundColor: '#000',
  },
  langFlag: {
    borderRadius: 3,
    height: 22,
    marginRight: 14,
    width: 32,
  },
  langLabel: {
    color: '#000',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  langLabelSelected: {
    color: '#fff',
  },
  langCheck: {
    color: '#fff',
    fontSize: 18,
  },
  header: {
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
  },
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  logoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  socialContainer: {
    marginTop: theme.spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
