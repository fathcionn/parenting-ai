import React, { useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useAuthStore } from '../stores/auth-store';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';

const languages = [
  { code: 'en', label: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  { code: 'ar', label: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'tr', label: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
];

const UI = {
  background: '#FCF8FF',
  card: '#FFFFFF',
  primary: '#4F46E5',
  primaryStrong: '#6366F1',
  primaryText: '#4648D4',
  activeTab: '#E1E0FF',
  border: '#E4E1ED',
  input: '#F1F5F9',
  text: '#1B1B23',
  muted: '#464554',
  faint: '#767586',
};

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

  const getPasswordStrength = () => {
    if (password.length < 6) return { label: 'Weak', color: '#DC2626', width: '33%' };
    const types = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;
    if (password.length >= 10 && types >= 2) return { label: 'Strong', color: '#16A34A', width: '100%' };
    return { label: 'Fair', color: '#F97316', width: '66%' };
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
                {currentLang === code && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
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
          <Text style={styles.logoSubtitle}>Empowering parenting with AI</Text>
        </View>

        <View style={styles.authCard}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, mode === 'signup' && styles.tabButtonActive]}
              onPress={() => router.push('/signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formBody}>
            <Text style={styles.formTitle}>{mode === 'login' ? 'Welcome back' : 'Create account'}</Text>
            <Text style={styles.formSubtitle}>
              {mode === 'login'
                ? 'Please enter your details to sign in.'
                : 'Enter your details to start using TalkWise.'}
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Email address</Text>
              <View style={[styles.inputShell, errors.email && styles.inputShellError]}>
                <Ionicons name="mail-outline" size={20} color={UI.faint} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
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
              <Text style={styles.inputLabel}>Password</Text>
              <View style={[styles.inputShell, errors.password && styles.inputShellError]}>
                <Ionicons name="lock-closed-outline" size={20} color={UI.faint} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
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
                <Text style={styles.inputLabel}>Confirm password</Text>
                <View style={[styles.inputShell, errors.confirmPassword && styles.inputShellError]}>
                  <Ionicons name="lock-closed-outline" size={20} color={UI.faint} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
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
                onPress={() => Alert.alert('Remember me', 'Your session is already managed securely by TalkWise.')}
                activeOpacity={0.8}
              >
                <View style={styles.checkbox} />
                <Text style={styles.optionText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleForgotPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} activeOpacity={0.85}>
              <Image
                source={{ uri: 'https://www.google.com/favicon.ico' }}
                style={styles.googleIcon}
                resizeMode="contain"
              />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footerText}>
          By continuing, you agree to our{' '}
          <Text style={styles.footerLink} onPress={() => Alert.alert('Terms of Service', 'Terms page coming soon.')}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={styles.footerLink} onPress={() => Alert.alert('Privacy Policy', 'Privacy page coming soon.')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    color: '#FFFFFF',
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
    borderColor: '#BA1A1A',
    backgroundColor: '#FFF5F5',
  },
  input: {
    flex: 1,
    color: UI.text,
    fontSize: 16,
    paddingVertical: Platform.OS === 'web' ? 14 : 0,
    outlineStyle: 'none' as any,
  },
  errorText: {
    color: '#BA1A1A',
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
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: UI.card,
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
