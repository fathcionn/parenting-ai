import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { setLanguage } from '../config/i18n';
import { useAppTheme } from '../context/ThemeContext';
import { useAuthStore } from '../stores/auth-store';
import { getStorageItem, STORAGE_KEYS } from '../services/storageKeys';

const languages = [
  { code: 'en', label: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'ar', label: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'tr', label: 'Turkce', flagUrl: 'https://flagcdn.com/w40/tr.png' },
];

type AuthPalette = {
  background: string;
  card: string;
  primary: string;
  primaryStrong: string;
  primaryText: string;
  activeTab: string;
  border: string;
  input: string;
  text: string;
  muted: string;
  faint: string;
  onPrimary: string;
  error: string;
  errorBg: string;
};

const getAuthPalette = (
  colors: ReturnType<typeof useAppTheme>['colors'],
  isDarkMode: boolean
): AuthPalette => ({
  background: colors.background,
  card: colors.card,
  primary: colors.primary,
  primaryStrong: colors.primary,
  primaryText: colors.onPrimary,
  activeTab: colors.primary,
  border: colors.border,
  input: colors.input,
  text: colors.text,
  muted: colors.muted,
  faint: colors.faint,
  onPrimary: colors.onPrimary,
  error: colors.danger,
  errorBg: isDarkMode ? '#3B1822' : '#FDECEA',
});

function setDocumentLanguage(langCode: string) {
  if (typeof document !== 'undefined') {
    const direction = langCode === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = direction;
    document.documentElement.lang = langCode;
    document.body.dir = direction;
    document.body.lang = langCode;
  }
}

export const AuthScreen: React.FC<{ mode: 'login' | 'signup' }> = ({ mode = 'login' }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const appTheme = useAppTheme();
  const UI = useMemo(
    () => getAuthPalette(appTheme.colors, appTheme.isDarkMode),
    [appTheme.colors, appTheme.isDarkMode]
  );
  const styles = useMemo(() => createStyles(UI), [UI]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLangModal, setShowLangModal] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setUser } = useAuthStore();

  useEffect(() => {
    getStorageItem(STORAGE_KEYS.speechLanguage).then((language) => {
      const lang = language || 'en';
      setCurrentLang(lang);
      setDocumentLanguage(lang);
    });
  }, []);

  async function changeLanguage(langCode: string) {
    await setLanguage(langCode);
    setDocumentLanguage(langCode);
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

  const getPasswordStrength = () => {
    if (password.length < 6) return { label: t('auth_password_weak'), color: '#FCA5A5', width: '33%' };
    const types = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    if (password.length >= 10 && types >= 2) return { label: t('auth_password_strong'), color: '#86EFAC', width: '100%' };
    return { label: t('auth_password_fair'), color: '#FDBA74', width: '66%' };
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('common_error'), t('auth_enter_email_first'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(t('auth_email_sent'), t('auth_password_reset_sent'));
    } catch (error: any) {
      Alert.alert(t('common_error'), error.message);
    }
  };

  const passwordStrength = getPasswordStrength();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.authGlobeButton}>
        <Ionicons name="globe-outline" size={22} color={UI.primary} />
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
                {currentLang === code && <Ionicons name="checkmark" size={18} color={UI.onPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <Text style={styles.logoText}>TalkWise</Text>
          <Text style={styles.logoSubtitle}>{t('auth_brand_subtitle')}</Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>{t('auth_login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'signup' && styles.tabButtonActive]}
              onPress={() => router.push('/signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>{t('auth_register')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formBody}>
            <Text style={styles.formTitle}>{mode === 'login' ? t('auth_welcome_back') : t('auth_signup')}</Text>
            <Text style={styles.formSubtitle}>
              {mode === 'login'
                ? t('auth_login_subtitle')
                : t('auth_signup_subtitle')}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>{t('auth_email')}</Text>
              <View style={[styles.inputShell, errors.email && styles.inputShellError]}>
                <Ionicons name="mail-outline" size={20} color={UI.faint} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth_email')}
                  placeholderTextColor={UI.faint}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>{t('auth_password')}</Text>
              <View style={[styles.inputShell, errors.password && styles.inputShellError]}>
                <Ionicons name="lock-closed-outline" size={20} color={UI.faint} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth_password')}
                  placeholderTextColor={UI.faint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)} activeOpacity={0.75}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={UI.faint} />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              {mode === 'signup' && password ? (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthTrack}>
                    <View
                      style={[
                        styles.strengthFill,
                        { width: passwordStrength.width as any, backgroundColor: passwordStrength.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
              ) : null}
            </View>

            {mode === 'signup' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>{t('auth_confirm_password')}</Text>
                <View style={[styles.inputShell, errors.confirmPassword && styles.inputShellError]}>
                  <Ionicons name="lock-closed-outline" size={20} color={UI.faint} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth_confirm_password')}
                    placeholderTextColor={UI.faint}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword((value) => !value)} activeOpacity={0.75}>
                    <Ionicons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={UI.faint} />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </View>
            )}

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => Alert.alert(t('auth_remember_me'), t('auth_session_managed'))}
                activeOpacity={0.8}
              >
                <View style={styles.checkbox} />
                <Text style={styles.optionText}>{t('auth_remember_me')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.forgotText}>{t('auth_forgot_password')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? t('common_loading') : mode === 'login' ? t('auth_login') : t('auth_signup')}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={UI.onPrimary} />
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth_or_continue')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} activeOpacity={0.85}>
              <Image
                source={{ uri: 'https://www.google.com/favicon.ico' }}
                style={styles.googleIcon}
                resizeMode="contain"
              />
              <Text style={styles.socialButtonText}>{t('auth_google')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerText}>
          {t('auth_terms_prefix')}{' '}
          <Text style={styles.footerLink} onPress={() => Alert.alert(t('auth_terms'), t('auth_terms_soon'))}>
            {t('auth_terms')}
          </Text>{' '}
          {t('auth_terms_and')}{' '}
          <Text style={styles.footerLink} onPress={() => Alert.alert(t('auth_privacy'), t('auth_privacy_soon'))}>
            {t('auth_privacy')}
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (UI: AuthPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.background,
  },
  authGlobeButton: {
    alignItems: 'center',
    backgroundColor: UI.card,
    borderColor: UI.border,
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
    backgroundColor: UI.card,
    borderRadius: 24,
    padding: 24,
    width: 260,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 20px 45px rgba(17, 24, 39, 0.18)',
      } as any,
    }),
  },
  langTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  langOption: {
    alignItems: 'center',
    backgroundColor: UI.input,
    borderRadius: 14,
    flexDirection: 'row',
    marginBottom: 8,
    padding: 14,
  },
  langOptionSelected: {
    backgroundColor: UI.primaryStrong,
  },
  langFlag: {
    borderRadius: 3,
    height: 22,
    marginRight: 14,
    width: 32,
  },
  langLabel: {
    color: UI.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  langLabelSelected: {
    color: UI.onPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 56,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoText: {
    color: UI.primary,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoSubtitle: {
    color: UI.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 6,
    textAlign: 'center',
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: UI.card,
    borderRadius: 24,
    borderBottomWidth: 4,
    borderBottomColor: '#E1E0FF',
    overflow: 'hidden',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 34,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 24px 60px rgba(49, 46, 129, 0.14)',
      } as any,
    }),
  },
  tabBar: {
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
    padding: 14,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 11,
  },
  tabButtonActive: {
    backgroundColor: UI.activeTab,
  },
  tabText: {
    color: UI.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  tabTextActive: {
    color: UI.primaryText,
    fontWeight: '800',
  },
  formBody: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 26,
  },
  formTitle: {
    color: UI.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  formSubtitle: {
    color: UI.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: UI.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: UI.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
  },
  inputShellError: {
    borderColor: UI.error,
    backgroundColor: UI.errorBg,
  },
  input: {
    flex: 1,
    color: UI.text,
    fontSize: 16,
    paddingVertical: Platform.OS === 'web' ? 14 : 0,
    outlineStyle: 'none' as any,
  },
  errorText: {
    color: UI.error,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  strengthRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  strengthTrack: {
    backgroundColor: UI.border,
    borderRadius: 999,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  strengthFill: {
    borderRadius: 999,
    height: '100%',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: UI.border,
    backgroundColor: UI.input,
  },
  optionText: {
    color: UI.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  forgotText: {
    color: UI.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: UI.primaryStrong,
    borderRadius: 999,
    marginBottom: 24,
    shadowColor: UI.primaryStrong,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 30px rgba(99, 102, 241, 0.28)',
      } as any,
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: UI.onPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  googleIcon: {
    height: 18,
    width: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: UI.border,
  },
  dividerText: {
    paddingHorizontal: 14,
    color: UI.faint,
    fontSize: 14,
  },
  socialButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 999,
    backgroundColor: UI.input,
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: UI.text,
  },
  footerText: {
    width: '100%',
    maxWidth: 390,
    color: UI.faint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 22,
    textAlign: 'center',
  },
  footerLink: {
    color: UI.primary,
    fontWeight: '800',
  },
});
