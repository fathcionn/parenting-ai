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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { Container, Card } from '../components/Layout';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { colors } from '../theme/colors';
import { spacing, radius, shadows } from '../theme/spacing';
import { typeScale } from '../theme/typography';

const languages = [
  { code: 'en', label: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'ar', label: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'tr', label: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
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
    getStorageItem(STORAGE_KEYS.speechLanguage).then((language) => {
      const lang = language || 'en';
      setCurrentLang(lang);
      setDocumentLanguage(lang);
    });
  }, []);

  async function changeLanguage(langCode: string) {
    await setStorageItem(STORAGE_KEYS.speechLanguage, langCode);
    await setStorageItem(STORAGE_KEYS.languageChosen, 'true');
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
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = t('auth_email_invalid');

    if (!password) newErrors.password = t('auth_password_required');
    else if (password.length < 6) {
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
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        router.replace('/(drawer)' as any);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        router.replace('/(drawer)' as any);
      }
    } catch (error: any) {
      Alert.alert(t('common_error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      useAuthStore.getState().setUser(result.user);
      router.replace('/(drawer)' as any);
    } catch (error: any) {
      Alert.alert(t('auth_google_failed'), error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.authGlobeButton}>
        <Ionicons name="globe-outline" size={22} color={colors.light.primary} />
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
                {currentLang === code && <Ionicons name="checkmark" size={18} color={colors.light.onPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Container scroll>
        <Card>
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <LinearGradient
              colors={['transparent', colors.light.card]}
              style={styles.logoFade}
            />
          </View>
          <Text style={styles.cardTitle}>
            {mode === 'login' ? t('auth_login') : t('auth_signup')}
          </Text>

          <TextField
            label={t('auth_email')}
            placeholder={t('auth_email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            editable={!loading}
          />

          <TextField
            label={t('auth_password')}
            placeholder={t('auth_password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
            editable={!loading}
          />

          {mode === 'signup' && (
            <TextField
              label={t('auth.confirmPassword')}
              placeholder={t('auth.confirmPassword')}
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
              <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
                <Image
                  source={{ uri: 'https://www.google.com/favicon.ico' }}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.socialButtonText}>{t('auth_google')}</Text>
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
    backgroundColor: colors.light.surface,
  },
  authGlobeButton: {
    alignItems: 'center',
    backgroundColor: colors.light.card,
    borderColor: colors.light.border,
    borderWidth: 1,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    zIndex: 100,
  },
  langBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  langModal: {
    backgroundColor: colors.light.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: 260,
    ...shadows.overlay,
  },
  langTitle: {
    color: colors.light.text,
    ...typeScale.subheading,
    marginBottom: spacing.md,
  },
  langOption: {
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    padding: 14,
  },
  langOptionSelected: {
    backgroundColor: colors.light.primary,
  },
  langFlag: {
    borderRadius: 3,
    height: 22,
    marginRight: 14,
    width: 32,
  },
  langLabel: {
    color: colors.light.text,
    flex: 1,
    ...typeScale.button,
  },
  langLabelSelected: {
    color: colors.light.onPrimary,
  },
  logoWrap: {
    alignSelf: 'center',
    height: 80,
    marginBottom: 12,
    width: 80,
  },
  logoImage: {
    borderRadius: 16,
    height: 80,
    width: 80,
  },
  logoFade: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    bottom: 0,
    height: 35,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cardTitle: {
    color: colors.light.text,
    ...typeScale.h2,
    marginBottom: spacing.md,
  },
  googleIcon: {
    height: 18,
    width: 18,
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
    backgroundColor: colors.light.border,
  },
  dividerText: {
    paddingHorizontal: theme.spacing.md,
    color: colors.light.muted,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radius.full,
    backgroundColor: colors.light.card,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.light.text,
  },
});
