import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { deleteUser, signOut, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button } from '../components/Button';
import { Card, Container } from '../components/Layout';
import { setLanguage } from '../config/i18n';
import { auth, db, storage } from '../config/firebase-config';
import { useAppTheme } from '../context/ThemeContext';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { COLORS as DEFAULT_COLORS, DARK_COLORS, LIGHT_COLORS } from '../theme/colors';
import { radius, shadows } from '../theme/spacing';
import { reportScoreFromData, toReportDate } from '../utils/reportUtils';

type ProfileStats = {
  totalSessions: number;
  averageScore: number;
  streak: number;
};

const calculateDayStreak = (dates: Date[]) => {
  const days = new Set(dates.map((date) => date.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

function ChildIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="7" r="4" stroke={DEFAULT_COLORS.primary} strokeWidth="2" />
      <Path
        d="M4 20C4 16 7.58 13 12 13C16.42 13 20 16 20 20"
        stroke={DEFAULT_COLORS.primary}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export const ProfileScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, user, updateProfile } = useAuthStore();
  const { isDarkMode, setDarkMode } = useAppTheme();
  const COLORS = useMemo(() => (isDarkMode ? DARK_COLORS : LIGHT_COLORS), [isDarkMode]);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('default');
  const [showChildModal, setShowChildModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalSessions: 0,
    averageScore: 0,
    streak: 0,
  });
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childPhotoUri, setChildPhotoUri] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [safeZoneRadius, setSafeZoneRadius] = useState('500');
  const [showMicPicker, setShowMicPicker] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(Boolean((profile as any)?.notificationsEnabled));
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || t('profile_default_user');
  const email = user?.email || profile?.email || '';
  const avatarUrl = profile?.photoURL || user?.photoURL || '';
  const avatarInitial = displayName.trim()[0]?.toUpperCase() || 'T';
  const micOptions = [
    { id: 'default', name: t('profile_this_device') },
    ...microphones.map((mic, index) => ({
      id: mic.deviceId,
      name: mic.label || `${t('profile_microphone')} ${index + 1}`,
    })),
  ];

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  useEffect(() => {
    getStorageItem(STORAGE_KEYS.speechLanguage).then((language) => {
      setCurrentLanguage(language || i18n.language || 'en');
    });
  }, [i18n.language]);

  useEffect(() => {
    async function loadMics() {
      try {
        const saved = await AsyncStorage.getItem('selectedMicId');
        if (saved) setSelectedMicId(saved);

        if (Platform.OS !== 'web') return;
        if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) return;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((device) => device.kind === 'audioinput');
        setMicrophones(mics);

        const legacySaved = await getStorageItem(STORAGE_KEYS.micId);
        if (!saved && legacySaved) {
          setSelectedMicId(legacySaved);
          await AsyncStorage.setItem('selectedMicId', legacySaved);
        }
      } catch (err) {
        console.error('Could not load microphones:', err);
      }
    }

    loadMics();
  }, []);

  useEffect(() => {
    async function loadStats() {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setProfileStats({ totalSessions: 0, averageScore: 0, streak: 0 });
        return;
      }

      try {
        const snapshot = await getDocs(
          query(collection(db, 'users', currentUser.uid, 'reports'), orderBy('date', 'desc'))
        );
        const reports = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            score: reportScoreFromData(data),
            date: toReportDate(data.date || data.createdAt),
          };
        });
        const totalSessions = reports.length;
        const averageScore = totalSessions
          ? Math.round(reports.reduce((sum, item) => sum + item.score, 0) / totalSessions)
          : 0;
        setProfileStats({
          totalSessions,
          averageScore,
          streak: calculateDayStreak(reports.map((item) => item.date)),
        });
      } catch (error) {
        console.error('Failed to load profile stats:', error);
      }
    }

    loadStats();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      useAuthStore.getState().clearUser();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert(t('common_error'), t('common_failed_logout'));
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert(t('common_error'), t('profile_name_required'));
      return;
    }
    if (!auth.currentUser) {
      Alert.alert(t('common_error'), t('profile_signin_required'));
      return;
    }

    try {
      await updateFirebaseProfile(auth.currentUser, { displayName: trimmed });
      updateProfile({ displayName: trimmed });
      setShowNameModal(false);
      Alert.alert(t('common.success'), t('profile_name_success'));
    } catch (error) {
      console.error('Edit name error:', error);
      Alert.alert(t('common_error'), t('profile_name_failed'));
    }
  };

  const handleAddChild = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const trimmedName = childName.trim();
      const parsedAge = Number(childAge);
      if (!trimmedName || !Number.isFinite(parsedAge) || parsedAge <= 0) {
        Alert.alert(t('common_error'), t('profile_child_required'));
        return;
      }

      let photoUrl = '';
      if (childPhotoUri) {
        const response = await fetch(childPhotoUri);
        const blob = await response.blob();
        const photoRef = ref(storage, `users/${currentUser.uid}/children/${Date.now()}.jpg`);
        await uploadBytes(photoRef, blob);
        photoUrl = await getDownloadURL(photoRef);
      }

      const childData = {
        name: trimmedName,
        age: parsedAge,
        photoUrl,
        physicalDescription: physicalDescription.trim(),
        emergencyContact: emergencyContact.trim(),
        medicalNotes: medicalNotes.trim(),
        schoolName: schoolName.trim(),
        safeZoneRadius: Number(safeZoneRadius) || 500,
      };
      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'children'), {
        ...childData,
        createdAt: serverTimestamp(),
      });

      updateProfile({
        children: [
          ...(profile?.children || []),
          {
            id: docRef.id,
            name: childData.name,
            age: childData.age,
            createdAt: new Date(),
          },
        ],
      });
      setChildName('');
      setChildAge('');
      setChildPhotoUri('');
      setPhysicalDescription('');
      setEmergencyContact('');
      setMedicalNotes('');
      setSchoolName('');
      setSafeZoneRadius('500');
      setShowChildModal(false);
      Alert.alert(t('common.success'), t('profile_child_success'));
    } catch (error) {
      console.error('Add child error:', error);
      Alert.alert(t('common_error'), t('profile_child_failed'));
    }
  };

  async function pickChildPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setChildPhotoUri(result.assets[0].uri);
    }
  }

  async function pickAvatarPhoto() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const avatarRef = ref(storage, `users/${currentUser.uid}/profile/avatar.jpg`);
      await uploadBytes(avatarRef, blob);
      const photoURL = await getDownloadURL(avatarRef);
      await updateFirebaseProfile(currentUser, { photoURL });
      updateProfile({ photoURL });
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert(t('common_error'), t('profile_avatar_failed'));
    }
  }

  async function selectMic(deviceId: string) {
    setSelectedMicId(deviceId);
    await AsyncStorage.setItem('selectedMicId', deviceId);
    await setStorageItem(STORAGE_KEYS.micId, deviceId);
  }

  const handleAnonymousToggle = (value: boolean) => {
    updateProfile({ isAnonymous: value });
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    updateProfile({ notificationsEnabled: value } as any);
    const currentUser = auth.currentUser;
    if (currentUser) {
      await setDoc(doc(db, 'users', currentUser.uid), { notificationsEnabled: value }, { merge: true });
    }
  };

  const handleDarkModeToggle = async (value = !isDarkMode) => {
    await setDarkMode(value);
  };

  const changeLanguage = async (language: string) => {
    await i18n.changeLanguage(language);
    await setLanguage(language);
    setCurrentLanguage(language);
    setShowLanguageModal(false);
  };

  const handleDeleteData = () => {
    Alert.alert(
      t('common_are_you_sure'),
      t('profile_delete_warning'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('profile_delete_everything'),
          style: 'destructive',
          onPress: async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;
            try {
              for (const name of ['reports', 'children', 'badges']) {
                const snapshot = await getDocs(collection(db, 'users', currentUser.uid, name));
                await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
              }
              await deleteDoc(doc(db, 'users', currentUser.uid));
              await deleteUser(currentUser);
              useAuthStore.getState().clearUser();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert(t('common_error'), error.message || t('profile_delete_warning'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>{t('profile_page_title')}</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setShowNameModal(true)} activeOpacity={0.8}>
            <Text style={styles.editButtonText}>{t('profile_edit_short')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.coverBanner} />
          <View style={styles.profileInfo}>
            <TouchableOpacity style={styles.avatarEditWrap} onPress={pickAvatarPhoto} activeOpacity={0.82}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />
              ) : (
                <View style={styles.profileAvatarFallback}>
                  <Text style={styles.profileAvatarInitial}>{avatarInitial}</Text>
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <MaterialIcons name="photo-camera" size={16} color={COLORS.onPrimary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{email || t('profile_default_email')}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.profileBadge}>
                <MaterialIcons name="verified-user" size={16} color={COLORS.primary} />
                <Text style={styles.verifiedBadgeText}>{t('profile_verified_parent')}</Text>
              </View>
              <View style={styles.profileBadge}>
                <MaterialIcons name="star" size={16} color={COLORS.accent} />
                <Text style={styles.premiumBadgeText}>{t('profile_premium_member')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.historyIcon]}>
              <MaterialIcons name="history" size={23} color={COLORS.primary} />
            </View>
            <Text style={styles.statValue}>{profileStats.totalSessions}</Text>
            <Text style={styles.statLabel}>{t('profile_sessions')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.analyticsIcon]}>
              <MaterialIcons name="analytics" size={23} color={COLORS.accent} />
            </View>
            <Text style={styles.statValue}>{profileStats.averageScore}</Text>
            <Text style={styles.statLabel}>{t('profile_avg_score')}</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.streakIcon]}>
              <MaterialIcons name="local-fire-department" size={23} color={COLORS.warning} />
            </View>
            <Text style={styles.statValue}>{profileStats.streak}</Text>
            <Text style={styles.statLabel}>{t('profile_streak')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('profile_my_children')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childrenRow}>
          {(profile?.children?.length ?? 0) > 0 ? (
                profile?.children?.map((child, childIndex) => (
                  <View key={child.id} style={styles.childCard}>
                    <View style={[styles.childAvatar, childIndex % 2 === 0 ? styles.childAvatarPurple : styles.childAvatarOrange]}>
                      <Text style={styles.childAvatarText}>{child.name.trim()[0]?.toUpperCase() || 'C'}</Text>
                    </View>
                    <Text style={styles.childCardName}>{child.name}</Text>
                  <Text style={styles.childCardAge}>{t('profile.age')} {child.age}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.childCard}>
                  <View style={[styles.childAvatar, styles.childAvatarPurple]}>
                    <Text style={styles.childAvatarText}>
                      {t('history_default_child').trim()[0]?.toUpperCase() || 'C'}
                    </Text>
                  </View>
                  <Text style={styles.childCardName}>{t('history_default_child')}</Text>
                  <Text style={styles.childCardAge}>{t('profile_add_a_child')}</Text>
                </View>
              )}
          <TouchableOpacity style={styles.addChildCard} onPress={() => setShowChildModal(true)} activeOpacity={0.82}>
            <View style={styles.addChildIconCircle}>
              <MaterialIcons name="add" size={26} color={COLORS.primary} />
            </View>
            <Text style={styles.addChildText}>{t('profile_add_child')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.settingsCard}>
          <TouchableOpacity style={[styles.settingItem, styles.settingDivider]} onPress={() => setShowMicPicker(true)} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="mic" size={22} color={COLORS.textSecondary} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('profile_audio_settings')}</Text>
                <Text style={styles.settingSubtitle}>{t('profile_audio_subtitle')}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, styles.settingDivider]}
            onPress={() => handleDarkModeToggle()}
            activeOpacity={0.82}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="dark-mode" size={22} color={COLORS.textSecondary} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('profile_dark_mode')}</Text>
                <Text style={styles.settingSubtitle}>{t('profile_dark_mode_subtitle')}</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: COLORS.surfaceVariant, true: COLORS.primary }}
              thumbColor={COLORS.onPrimary}
            />
          </TouchableOpacity>

          <View style={[styles.settingItem, styles.settingDivider]}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="notifications" size={22} color={COLORS.textSecondary} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('profile_notifications')}</Text>
                <Text style={styles.settingSubtitle}>{t('profile_notifications_subtitle')}</Text>
              </View>
            </View>
            <Switch value={notificationsEnabled} onValueChange={handleNotificationsToggle} trackColor={{ false: COLORS.surfaceVariant, true: COLORS.primary }} thumbColor={COLORS.onPrimary} />
          </View>

          <TouchableOpacity style={[styles.settingItem, styles.settingDivider]} onPress={() => setShowLanguageModal(true)} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="translate" size={22} color={COLORS.textSecondary} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{t('profile_language')}</Text>
                <Text style={styles.settingSubtitle}>{currentLanguage.toUpperCase()}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.outline} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleLogout} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.logoutIconBox}>
                <MaterialIcons name="logout" size={22} color={COLORS.error} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.logoutTitle}>{t('common_logout')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteDataButton} onPress={handleDeleteData} activeOpacity={0.82}>
          <MaterialIcons name="delete-forever" size={22} color={COLORS.error} />
          <Text style={styles.deleteDataText}>{t('profile_delete_data')}</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>{t('profile_version')}</Text>
      </ScrollView>

      <Modal visible={showMicPicker} transparent animationType="slide" onRequestClose={() => setShowMicPicker(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMicPicker(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>{t('profile_select_microphone')}</Text>
            {micOptions.map((mic) => (
              <TouchableOpacity
                key={mic.id}
                style={styles.languageOption}
                onPress={async () => {
                  await selectMic(mic.id);
                  setShowMicPicker(false);
                }}
              >
                <Text style={styles.settingTitle}>{mic.name}</Text>
                {selectedMicId === mic.id ? (
                  <MaterialIcons name="check" size={20} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowMicPicker(false)}>
              <Text style={styles.modalSecondaryText}>{t('common_cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('lang_select')}</Text>
            {[
              { code: 'en', label: t('lang_english') },
              { code: 'ar', label: t('lang_arabic') },
              { code: 'tr', label: t('lang_turkish') },
            ].map((language) => (
              <TouchableOpacity
                key={language.code}
                style={styles.languageOption}
                onPress={() => changeLanguage(language.code)}
              >
                <Text style={styles.settingTitle}>{language.label}</Text>
                {currentLanguage === language.code ? (
                  <MaterialIcons name="check" size={20} color={COLORS.primary} />
                ) : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalSecondaryText}>{t('common_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile_edit_name')}</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('profile_display_name')}
          placeholderTextColor={COLORS.textFaint}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.modalSecondaryText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleSaveName}>
                <Text style={styles.modalPrimaryText}>{t('common_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showChildModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile_add_child')}</Text>
            <TextInput
              value={childName}
              onChangeText={setChildName}
              placeholder={t('profile_child_name')}
              placeholderTextColor={COLORS.textFaint}
              style={styles.modalInput}
            />
            <TextInput
              value={childAge}
              onChangeText={setChildAge}
              placeholder={t('profile.age')}
              placeholderTextColor={COLORS.textFaint}
              keyboardType="numeric"
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondaryButton}
                onPress={() => setShowChildModal(false)}
              >
                <Text style={styles.modalSecondaryText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleAddChild}>
                <Text style={styles.modalPrimaryText}>{t('common_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};


const createStyles = (COLORS: typeof DEFAULT_COLORS) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 48, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { color: COLORS.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: '900' },
  editButton: { backgroundColor: COLORS.surfaceContainer, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 9 },
  editButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  profileCard: { backgroundColor: COLORS.cardBg, borderRadius: radius.xl, overflow: 'hidden', shadowColor: COLORS.primaryDark, shadowOffset: shadows.overlay.shadowOffset, shadowOpacity: shadows.overlay.shadowOpacity, shadowRadius: shadows.overlay.shadowRadius, elevation: shadows.overlay.elevation, ...Platform.select({ web: { boxShadow: '0px 26px 64px rgba(76, 29, 149, 0.14)' } as any }) },
  coverBanner: { height: 80, backgroundColor: COLORS.surfaceContainerHigh },
  profileInfo: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 24, marginTop: -40 },
  avatarEditWrap: { position: 'relative', marginBottom: 10 },
  profileAvatarImage: { width: 80, height: 80, borderRadius: radius.full, borderWidth: 4, borderColor: COLORS.cardBg, backgroundColor: COLORS.surfaceVariant },
  profileAvatarFallback: { width: 80, height: 80, borderRadius: radius.full, borderWidth: 4, borderColor: COLORS.cardBg, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primaryDark, shadowOffset: shadows.card.shadowOffset, shadowOpacity: shadows.card.shadowOpacity, shadowRadius: shadows.card.shadowRadius, elevation: shadows.card.elevation },
  avatarCameraBadge: { position: 'absolute', right: -2, bottom: 2, width: 28, height: 28, borderRadius: radius.full, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  profileAvatarInitial: { color: COLORS.onPrimary, fontSize: 30, fontWeight: '900' },
  profileName: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  profileEmail: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surfaceContainer, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7 },
  verifiedBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  premiumBadgeText: { color: COLORS.accent, fontSize: 12, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 8, shadowColor: COLORS.primaryDark, shadowOffset: shadows.card.shadowOffset, shadowOpacity: shadows.card.shadowOpacity, shadowRadius: shadows.card.shadowRadius, elevation: shadows.card.elevation, ...Platform.select({ web: { boxShadow: '0px 16px 34px rgba(76, 29, 149, 0.09)' } as any }) },
  statIcon: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  historyIcon: { backgroundColor: COLORS.surfaceContainerHigh },
  analyticsIcon: { backgroundColor: COLORS.surfaceContainer },
  streakIcon: { backgroundColor: COLORS.warningBg },
  statValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textFaint, fontSize: 12, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginTop: 2 },
  childrenRow: { gap: 16, paddingRight: 24 },
  childCard: { width: 120, minHeight: 136, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, borderRadius: radius.lg, padding: 14 },
  childAvatar: { width: 56, height: 56, borderRadius: radius.full, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, marginBottom: 10 },
  childAvatarPurple: { borderColor: COLORS.accent },
  childAvatarOrange: { borderColor: COLORS.warning },
  childAvatarText: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900' },
  childCardName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  childCardAge: { color: COLORS.textFaint, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  addChildCard: { width: 120, minHeight: 136, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceContainer, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.outline, borderRadius: radius.lg, padding: 14 },
  addChildIconCircle: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  addChildText: { color: COLORS.primary, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  settingsCard: { backgroundColor: COLORS.cardBg, borderRadius: radius.xl, overflow: 'hidden', shadowColor: COLORS.primaryDark, shadowOffset: shadows.card.shadowOffset, shadowOpacity: shadows.card.shadowOpacity, shadowRadius: shadows.card.shadowRadius, elevation: shadows.card.elevation, ...Platform.select({ web: { boxShadow: '0px 18px 42px rgba(76, 29, 149, 0.10)' } as any }) },
  settingItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  settingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIconBox: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceContainer },
  logoutIconBox: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.errorBg },
  settingCopy: { flex: 1 },
  settingTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '900' },
  settingSubtitle: { color: COLORS.textFaint, fontSize: 13, fontWeight: '600', marginTop: 3 },
  logoutTitle: { color: COLORS.error, fontSize: 16, fontWeight: '900' },
  footerText: { color: COLORS.textFaint, fontSize: 12, fontWeight: '700', textAlign: 'center', marginVertical: 24 },
  deleteDataButton: { alignItems: 'center', backgroundColor: COLORS.errorBg, borderRadius: radius.xl, flexDirection: 'row', gap: 10, justifyContent: 'center', padding: 16 },
  deleteDataText: { color: COLORS.error, fontSize: 16, fontWeight: '900' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '86%', backgroundColor: COLORS.cardBg, borderRadius: radius.xl, padding: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: radius.lg, color: COLORS.textPrimary, fontSize: 15, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 4 },
  modalSecondaryButton: { borderRadius: radius.full, borderWidth: 1, borderColor: COLORS.outline, paddingHorizontal: 18, paddingVertical: 11 },
  modalSecondaryText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '900' },
  modalPrimaryButton: { borderRadius: radius.full, backgroundColor: COLORS.accent, paddingHorizontal: 18, paddingVertical: 11 },
  modalPrimaryText: { color: COLORS.onPrimary, fontSize: 14, fontWeight: '900' },
  languageOption: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  photoButton: { alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.outline, backgroundColor: COLORS.surfaceContainer, padding: 14, marginBottom: 12 },
  photoButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
});

