import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { deleteUser, signOut, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    I18nManager,
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
import { auth, db, storage } from '../config/firebase-config';
import { useAppTheme } from '../context/ThemeContext';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { COLORS } from '../theme/colors';
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
      <Circle cx="12" cy="7" r="4" stroke={COLORS.primary} strokeWidth="2" />
      <Path
        d="M4 20C4 16 7.58 13 12 13C16.42 13 20 16 20 20"
        stroke={COLORS.primary}
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
  const { isDarkMode, setDarkMode, colors } = useAppTheme();
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
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'TalkWise User';
  const email = user?.email || profile?.email || '';
  const avatarUrl = profile?.photoURL || user?.photoURL || '';
  const avatarInitial = displayName.trim()[0]?.toUpperCase() || 'T';
  const micOptions = [
    { id: 'default', name: 'This device' },
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
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }
    if (!auth.currentUser) {
      Alert.alert('Error', 'You need to be signed in to edit your name.');
      return;
    }

    try {
      await updateFirebaseProfile(auth.currentUser, { displayName: trimmed });
      updateProfile({ displayName: trimmed });
      setShowNameModal(false);
      Alert.alert('Success', 'Name updated successfully.');
    } catch (error) {
      console.error('Edit name error:', error);
      Alert.alert('Error', 'Failed to update your name. Please try again.');
    }
  };

  const handleAddChild = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const trimmedName = childName.trim();
      const parsedAge = Number(childAge);
      if (!trimmedName || !Number.isFinite(parsedAge) || parsedAge <= 0) {
        Alert.alert('Error', 'Please enter a valid child name and age.');
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
      Alert.alert('Success', 'Child added successfully!');
    } catch (error) {
      console.error('Add child error:', error);
      Alert.alert('Error', 'Failed to add child. Please try again.');
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
      Alert.alert('Error', 'Failed to update avatar. Please try again.');
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
    await setStorageItem(STORAGE_KEYS.speechLanguage, language);
    await setStorageItem(STORAGE_KEYS.languageChosen, 'true');
    await AsyncStorage.setItem('app-language', language);
    await i18n.changeLanguage(language);
    I18nManager.forceRTL(language === 'ar');
    setCurrentLanguage(language);
    setShowLanguageModal(false);
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Are you sure?',
      'This will permanently delete all your sessions, insights, and account data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
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
              Alert.alert('Error', error.message || 'Failed to delete data. Please sign in again and retry.');
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
          <Text style={styles.pageTitle}>Profile</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setShowNameModal(true)} activeOpacity={0.8}>
            <Text style={styles.editButtonText}>Edit</Text>
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
                <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{email || 'sarah.miller@example.com'}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.profileBadge}>
                <MaterialIcons name="verified-user" size={16} color="#4648D4" />
                <Text style={styles.verifiedBadgeText}>Verified Parent</Text>
              </View>
              <View style={styles.profileBadge}>
                <MaterialIcons name="star" size={16} color="#6B38D4" />
                <Text style={styles.premiumBadgeText}>Premium Member</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.historyIcon]}>
              <MaterialIcons name="history" size={23} color="#4648D4" />
            </View>
            <Text style={styles.statValue}>{profileStats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.analyticsIcon]}>
              <MaterialIcons name="analytics" size={23} color="#6B38D4" />
            </View>
            <Text style={styles.statValue}>{profileStats.averageScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.streakIcon]}>
              <MaterialIcons name="local-fire-department" size={23} color="#904900" />
            </View>
            <Text style={styles.statValue}>{profileStats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>My Children</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.childrenRow}>
          {(profile?.children?.length ?? 0) > 0 ? (
                profile?.children?.map((child, childIndex) => (
                  <View key={child.id} style={styles.childCard}>
                    <View style={[styles.childAvatar, childIndex % 2 === 0 ? styles.childAvatarPurple : styles.childAvatarOrange]}>
                      <Text style={styles.childAvatarText}>{child.name.trim()[0]?.toUpperCase() || 'C'}</Text>
                    </View>
                    <Text style={styles.childCardName}>{child.name}</Text>
                    <Text style={styles.childCardAge}>Age {child.age}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.childCard}>
                  <View style={[styles.childAvatar, styles.childAvatarPurple]}>
                    <Text style={styles.childAvatarText}>L</Text>
                  </View>
                  <Text style={styles.childCardName}>Leo</Text>
                  <Text style={styles.childCardAge}>Add a child</Text>
                </View>
              )}
          <TouchableOpacity style={styles.addChildCard} onPress={() => setShowChildModal(true)} activeOpacity={0.82}>
            <View style={styles.addChildIconCircle}>
              <MaterialIcons name="add" size={26} color="#4648D4" />
            </View>
            <Text style={styles.addChildText}>Add Child</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.settingsCard}>
          <TouchableOpacity style={[styles.settingItem, styles.settingDivider]} onPress={() => setShowMicPicker(true)} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="mic" size={22} color="#464554" />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Audio Settings</Text>
                <Text style={styles.settingSubtitle}>Manage microphone input</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#C7C4D7" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, styles.settingDivider]}
            onPress={() => handleDarkModeToggle()}
            activeOpacity={0.82}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="dark-mode" size={22} color="#464554" />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.settingSubtitle}>Toggle visual theme</Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: '#E4E1ED', true: '#4648D4' }}
              thumbColor="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={[styles.settingItem, styles.settingDivider]}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="notifications" size={22} color="#464554" />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Notifications</Text>
                <Text style={styles.settingSubtitle}>Session reminders and safety alerts</Text>
              </View>
            </View>
            <Switch value={notificationsEnabled} onValueChange={handleNotificationsToggle} trackColor={{ false: '#E4E1ED', true: '#4648D4' }} thumbColor="#FFFFFF" />
          </View>

          <TouchableOpacity style={[styles.settingItem, styles.settingDivider]} onPress={() => setShowLanguageModal(true)} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIconBox}>
                <MaterialIcons name="translate" size={22} color="#464554" />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Language</Text>
                <Text style={styles.settingSubtitle}>{currentLanguage.toUpperCase()}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#C7C4D7" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleLogout} activeOpacity={0.82}>
            <View style={styles.settingLeft}>
              <View style={styles.logoutIconBox}>
                <MaterialIcons name="logout" size={22} color="#BA1A1A" />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.logoutTitle}>Logout</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteDataButton} onPress={handleDeleteData} activeOpacity={0.82}>
          <MaterialIcons name="delete-forever" size={22} color="#BA1A1A" />
          <Text style={styles.deleteDataText}>Delete My Data</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>TalkWise v1.0.0</Text>
      </ScrollView>

      <Modal visible={showMicPicker} transparent animationType="slide" onRequestClose={() => setShowMicPicker(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMicPicker(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <Text style={styles.modalTitle}>Select Microphone</Text>
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
                  <MaterialIcons name="check" size={20} color="#4648D4" />
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
            <Text style={styles.modalTitle}>Language</Text>
            {[
              { code: 'en', label: 'English' },
              { code: 'ar', label: 'Arabic' },
              { code: 'tr', label: 'Turkish' },
            ].map((language) => (
              <TouchableOpacity
                key={language.code}
                style={styles.languageOption}
                onPress={() => changeLanguage(language.code)}
              >
                <Text style={styles.settingTitle}>{language.label}</Text>
                {currentLanguage === language.code ? (
                  <MaterialIcons name="check" size={20} color="#4648D4" />
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
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Display name"
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
            <TouchableOpacity style={styles.photoButton} onPress={pickChildPhoto}>
              <Text style={styles.photoButtonText}>
                {childPhotoUri ? 'Photo selected ✓' : 'Upload child photo'}
              </Text>
            </TouchableOpacity>
            <TextInput
              value={childName}
              onChangeText={setChildName}
              placeholder="Child name"
            placeholderTextColor={COLORS.textFaint}
              style={styles.modalInput}
            />
            <TextInput
              value={childAge}
              onChangeText={setChildAge}
              placeholder="Age"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="numeric"
              style={styles.modalInput}
            />
            <TextInput
              value={physicalDescription}
              onChangeText={setPhysicalDescription}
              placeholder="Physical description"
              placeholderTextColor={COLORS.textFaint}
              style={styles.modalInput}
            />
            <TextInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder="Emergency contact number"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="phone-pad"
              style={styles.modalInput}
            />
            <TextInput
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              placeholder="Medical notes / allergies"
              placeholderTextColor={COLORS.textFaint}
              multiline
              style={[styles.modalInput, styles.multilineInput]}
            />
            <TextInput
              value={schoolName}
              onChangeText={setSchoolName}
              placeholder="School name"
            placeholderTextColor={COLORS.textFaint}
              style={styles.modalInput}
            />
            <TextInput
              value={safeZoneRadius}
              onChangeText={setSafeZoneRadius}
              placeholder="Safe zone radius in meters"
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


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCF8FF' },
  container: { flex: 1, backgroundColor: '#FCF8FF' },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 48, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { color: '#1B1B23', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  editButton: { backgroundColor: '#EFECF8', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  editButtonText: { color: '#4648D4', fontSize: 14, fontWeight: '900' },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#312E81', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 8, ...Platform.select({ web: { boxShadow: '0px 22px 54px rgba(49, 46, 129, 0.14)' } as any }) },
  coverBanner: { height: 80, backgroundColor: '#E1E0FF' },
  profileInfo: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 24, marginTop: -40 },
  avatarEditWrap: { position: 'relative', marginBottom: 10 },
  profileAvatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#E4E1ED' },
  profileAvatarFallback: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFFFFF', backgroundColor: '#4648D4', alignItems: 'center', justifyContent: 'center', shadowColor: '#312E81', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5 },
  avatarCameraBadge: { position: 'absolute', right: -2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: '#6366F1', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  profileAvatarInitial: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  profileName: { color: '#1B1B23', fontSize: 20, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  profileEmail: { color: '#464554', fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFECF8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  verifiedBadgeText: { color: '#4648D4', fontSize: 12, fontWeight: '900' },
  premiumBadgeText: { color: '#6B38D4', fontSize: 12, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E1ED', paddingVertical: 16, paddingHorizontal: 8, shadowColor: '#312E81', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 3, ...Platform.select({ web: { boxShadow: '0px 12px 24px rgba(49, 46, 129, 0.08)' } as any }) },
  statIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  historyIcon: { backgroundColor: '#E1E0FF' },
  analyticsIcon: { backgroundColor: '#E9DDFF' },
  streakIcon: { backgroundColor: '#FFDCC5' },
  statValue: { color: '#1B1B23', fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#767586', fontSize: 12, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  sectionTitle: { color: '#1B1B23', fontSize: 20, fontWeight: '900', marginTop: 2 },
  childrenRow: { gap: 16, paddingRight: 24 },
  childCard: { width: 120, minHeight: 136, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1ED', borderRadius: 12, padding: 14 },
  childAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginBottom: 10 },
  childAvatarPurple: { borderColor: '#8B5CF6' },
  childAvatarOrange: { borderColor: '#F97316' },
  childAvatarText: { color: '#1B1B23', fontSize: 20, fontWeight: '900' },
  childCardName: { color: '#1B1B23', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  childCardAge: { color: '#767586', fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  addChildCard: { width: 120, minHeight: 136, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2FE', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C7C4D7', borderRadius: 12, padding: 14 },
  addChildIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  addChildText: { color: '#4648D4', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  settingsCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E4E1ED', overflow: 'hidden', shadowColor: '#312E81', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 4, ...Platform.select({ web: { boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)' } as any }) },
  settingItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: '#E4E1ED' },
  settingLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFECF8' },
  logoutIconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFDAD6' },
  settingCopy: { flex: 1 },
  settingTitle: { color: '#1B1B23', fontSize: 16, fontWeight: '900' },
  settingSubtitle: { color: '#767586', fontSize: 13, fontWeight: '600', marginTop: 3 },
  logoutTitle: { color: '#BA1A1A', fontSize: 16, fontWeight: '900' },
  footerText: { color: '#767586', fontSize: 12, fontWeight: '700', textAlign: 'center', marginVertical: 24 },
  deleteDataButton: { alignItems: 'center', backgroundColor: '#FFDAD6', borderRadius: 16, flexDirection: 'row', gap: 10, justifyContent: 'center', padding: 16 },
  deleteDataText: { color: '#BA1A1A', fontSize: 16, fontWeight: '900' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, maxHeight: '86%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  modalTitle: { color: '#1B1B23', fontSize: 20, fontWeight: '900', marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: '#E4E1ED', borderRadius: 12, color: '#1B1B23', fontSize: 15, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 4 },
  modalSecondaryButton: { borderRadius: 999, borderWidth: 1, borderColor: '#C7C4D7', paddingHorizontal: 18, paddingVertical: 11 },
  modalSecondaryText: { color: '#464554', fontSize: 14, fontWeight: '900' },
  modalPrimaryButton: { borderRadius: 999, backgroundColor: '#6366F1', paddingHorizontal: 18, paddingVertical: 11 },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  languageOption: { alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E4E1ED', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  photoButton: { alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7C4D7', backgroundColor: '#F5F2FE', padding: 14, marginBottom: 12 },
  photoButtonText: { color: '#4648D4', fontSize: 14, fontWeight: '900' },
});
