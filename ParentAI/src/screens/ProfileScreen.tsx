import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
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
  const { t } = useTranslation();
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

  async function selectMic(deviceId: string) {
    setSelectedMicId(deviceId);
    await AsyncStorage.setItem('selectedMicId', deviceId);
    await setStorageItem(STORAGE_KEYS.micId, deviceId);
  }

  const handleAnonymousToggle = (value: boolean) => {
    updateProfile({ isAnonymous: value });
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete My Data',
      'This will permanently delete all your sessions, insights, and account data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Coming Soon', 'Contact support@talkwise.app to delete your data.');
          },
        },
      ]
    );
  };

  return (
    <Container scroll>
      <View style={styles.avatarSectionNew}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImageNew} />
        ) : (
          <View style={styles.avatarNew}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
        )}
        <Text style={styles.profileNameNew}>{displayName}</Text>
        <Text style={styles.profileEmailNew}>{email}</Text>
        <TouchableOpacity style={styles.editProfileButton} onPress={() => setShowNameModal(true)}>
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeaderNew}>Account & Profile</Text>
      <View style={styles.cardNew}>
        <View style={styles.cardTitleRow}>
          <ChildIcon />
          <Text style={styles.cardTitle}>Child Profiles</Text>
        </View>
        {(profile?.children?.length ?? 0) > 0 ? (
          profile?.children?.map((child) => (
            <View key={child.id} style={styles.childRowNew}>
              <Text style={styles.childNameNew}>{child.name}</Text>
              <Text style={styles.childAgeNew}>Age {child.age}</Text>
            </View>
          ))
        ) : (
          <View style={styles.childEmptyStateNew}>
            <Text style={styles.childEmptyTitleNew}>No children added yet</Text>
            <Text style={styles.childEmptyTextNew}>
              Add your child's profile to get personalized coaching insights.
            </Text>
          </View>
        )}
        <TouchableOpacity style={styles.outlinePillButton} onPress={() => setShowChildModal(true)}>
          <Text style={styles.outlinePillText}>+ Add Child</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeaderNew}>App Preferences</Text>
      <View style={styles.cardNew}>
        <View style={[styles.preferenceRow, styles.preferenceDivider]}>
          <View style={styles.preferenceText}>
            <View style={styles.preferenceLabelRow}>
              <Text style={styles.preferenceIcon}>☾</Text>
              <Text style={styles.preferenceLabel}>Dark Mode</Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: COLORS.surfaceContainerHigh, true: COLORS.primary }}
            thumbColor={COLORS.onPrimary}
          />
        </View>
        <View style={styles.preferenceRow}>
          <View style={styles.preferenceText}>
            <View style={styles.preferenceLabelRow}>
              <Text style={styles.preferenceIcon}>◇</Text>
              <Text style={styles.preferenceLabel}>Stay Anonymous</Text>
            </View>
            <Text style={styles.preferenceSubLabel}>Hide your identity in Community Benchmarks</Text>
          </View>
          <Switch
            value={Boolean(profile?.isAnonymous)}
            onValueChange={handleAnonymousToggle}
            trackColor={{ false: COLORS.surfaceContainerHigh, true: COLORS.primary }}
            thumbColor={COLORS.onPrimary}
          />
        </View>
      </View>

      <Text style={styles.sectionHeaderNew}>Device Setup</Text>
      <View style={styles.cardNew}>
        <Text style={styles.preferenceLabel}>Microphone</Text>
        <Text style={styles.preferenceSubLabel}>Select input device</Text>
        <TouchableOpacity
          style={{
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 10,
            padding: 14,
            marginTop: 8,
            backgroundColor: COLORS.cardBg,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onPress={() => setShowMicPicker(true)}
        >
          <Text style={{ 
            color: COLORS.textPrimary, 
            fontSize: 16 
          }}>
            {selectedMicId 
              ? micOptions.find(m => m.id === selectedMicId)?.name 
                ?? 'Select microphone'
              : 'Select microphone'}
          </Text>
          <Text style={{ color: COLORS.textSecondary }}>
            ▾
          </Text>
        </TouchableOpacity>
        {microphones.length === 0 ? <Text style={styles.emptyTextNew}>{t('profile_no_mics')}</Text> : null}
      </View>

      {/* Microphone Picker Modal */}
      <Modal
        visible={showMicPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMicPicker(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setShowMicPicker(false)}
        >
          <View style={{
            backgroundColor: COLORS.cardBg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 16,
            paddingBottom: 40,
          }}>
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: COLORS.border,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }} />
      
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: COLORS.textPrimary,
              paddingHorizontal: 24,
              marginBottom: 12,
            }}>
              Select Microphone
            </Text>
      
            {micOptions.map(mic => (
              <TouchableOpacity
                key={mic.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
                onPress={() => {
                  selectMic(mic.id);
                  setShowMicPicker(false);
                }}
              >
                <Text style={{
                  fontSize: 16,
                  color: COLORS.textPrimary,
                }}>
                  {mic.name}
                </Text>
                {selectedMicId === mic.id && (
                  <Text style={{ 
                    color: COLORS.primary, 
                    fontSize: 18 
                  }}>
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Text style={styles.sectionHeaderNew}>About & Actions</Text>
      <View style={styles.cardNew}>
        <View style={[styles.aboutRowNew, styles.preferenceDivider]}>
          <Text style={styles.preferenceLabel}>App Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <TouchableOpacity
          style={[styles.aboutRowNew, styles.preferenceDivider]}
          onPress={() => Linking.openURL('your-privacy-url')}
        >
          <View style={styles.preferenceLabelRow}>
            <Text style={styles.preferenceIcon}>◇</Text>
            <Text style={styles.preferenceLabel}>Privacy Policy</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.aboutRowNew, styles.preferenceDivider]}
          onPress={() => Linking.openURL('your-privacy-url')}
        >
          <View style={styles.preferenceLabelRow}>
            <Text style={styles.preferenceIcon}>□</Text>
            <Text style={styles.preferenceLabel}>Terms of Service</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.safetyNotice}>
          <Text style={styles.safetyText}>
            ⚠️ Audio is processed locally and never uploaded. Only text insights are stored in the cloud.
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
        <Text style={styles.signOutText}>{t('profile_sign_out')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteData}>
        <Text style={styles.deleteText}>Delete My Data</Text>
      </TouchableOpacity>

      {false && (
        <>
      <View style={[styles.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
        )}
        <Text style={[styles.profileName, { color: colors.text }]}>{displayName}</Text>
        <Text style={[styles.profileEmail, { color: colors.muted }]}>{email}</Text>
        <TouchableOpacity style={styles.editNameButton} onPress={() => setShowNameModal(true)}>
          <Text style={styles.editNameText}>✏️ Edit Name</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{profileStats.totalSessions}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Total Sessions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{profileStats.averageScore}%</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Average Score</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{profileStats.streak}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Day Streak</Text>
        </View>
      </View>

      <Card title={t('profile_child_profile')}>
        {(profile?.children?.length ?? 0) > 0 ? (
          profile?.children?.map((child) => (
            <View key={child.id} style={styles.childItem}>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.childAge}>{child.age}</Text>
            </View>
          ))
        ) : (
          <View style={styles.childEmptyState}>
            <Text style={styles.childEmptyIcon}>👶</Text>
            <Text style={styles.childEmptyTitle}>No children added yet</Text>
            <Text style={styles.childEmptyText}>
              Add your child's profile to get personalized coaching insights
            </Text>
          </View>
        )}
        <Button
          title={t('profile_add_child')}
          onPress={() => setShowChildModal(true)}
          variant="outline"
          fullWidth
        />
      </Card>

      <Card title={t('profile_parenting_score')}>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreText}>{profileStats.averageScore || profile?.parentingScore || 0}</Text>
          </View>
          <Text style={styles.scoreDescription}>{t('profile_score_subtitle')}</Text>
        </View>
      </Card>

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Dark Mode</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
              Switch TalkWise to a darker interface.
            </Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: COLORS.surfaceContainerHigh, true: COLORS.primary }}
            thumbColor={COLORS.onPrimary}
          />
        </View>
      </View>

      <Card title="Community Benchmarks">
        <Button
          title={profile?.isAnonymous ? 'Community Benchmarks' : t('profile_stay_anonymous')}
          onPress={() => router.push('/(drawer)/leaderboard' as any)}
          variant="outline"
          fullWidth
        />
      </Card>

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Audio Settings</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>🎙️ Audio Input Device</Text>

        <TouchableOpacity
          style={[styles.micRow, selectedMicId === 'default' && styles.selectedStyle]}
          onPress={() => selectMic('default')}
          activeOpacity={0.75}
        >
          <Text style={[styles.micLabel, selectedMicId === 'default' && styles.micLabelSelected]}>
            This device
          </Text>
          {selectedMicId === 'default' && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        {microphones.length === 0 ? (
          <Text style={styles.emptyText}>{t('profile_no_mics')}</Text>
        ) : (
          microphones.map((mic, index) => {
            const isSelected = selectedMicId === mic.deviceId;
            return (
              <TouchableOpacity
                key={mic.deviceId}
                style={[styles.micRow, isSelected && styles.selectedStyle]}
                onPress={() => selectMic(mic.deviceId)}
                activeOpacity={0.75}
              >
                <Text style={[styles.micLabel, isSelected && styles.micLabelSelected]}>
                  {mic.label || `${t('profile_microphone')} ${index + 1}`}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.aboutTitle, { color: colors.text }]}>TalkWise</Text>
        <Text style={[styles.aboutMeta, { color: colors.muted }]}>Version 1.0.0</Text>
        <Text style={[styles.aboutTagline, { color: colors.text }]}>AI-powered parenting coach</Text>
        <Text style={[styles.disclaimer, { color: colors.muted }]}>
          ⚠️ AI safety detection is a helpful guide and should not replace professional judgment.
        </Text>
      </View>

      <Button title={t('profile_sign_out')} onPress={handleLogout} variant="outline" fullWidth />
        </>
      )}

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
    </Container>
  );
};

const styles = StyleSheet.create({
  avatarSectionNew: {
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 16,
  },
  avatarNew: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  avatarImageNew: {
    borderRadius: 40,
    height: 80,
    width: 80,
  },
  profileNameNew: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  profileEmailNew: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  editProfileButton: {
    borderColor: COLORS.borderStrong,
    borderRadius: 9999,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  editProfileText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderNew: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  cardNew: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  childRowNew: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  childNameNew: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  childAgeNew: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  childEmptyStateNew: {
    paddingVertical: 12,
  },
  childEmptyTitleNew: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  childEmptyTextNew: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'center',
  },
  outlinePillButton: {
    alignItems: 'center',
    borderColor: COLORS.borderStrong,
    borderRadius: 9999,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 11,
  },
  outlinePillText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  preferenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 14,
  },
  preferenceDivider: {
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  preferenceIcon: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
    width: 22,
  },
  preferenceLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  preferenceSubLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  pickerWrap: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  picker: {
    color: COLORS.textPrimary,
  },
  webPickerRow: {
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  webPickerRowSelected: {
    backgroundColor: COLORS.surfaceContainer,
  },
  webPickerText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  webPickerTextSelected: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  emptyTextNew: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 10,
  },
  aboutRowNew: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: 12,
  },
  aboutValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chevron: {
    color: COLORS.textSecondary,
    fontSize: 26,
    lineHeight: 28,
  },
  safetyNotice: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 10,
    marginTop: 14,
    padding: 12,
  },
  safetyText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: COLORS.errorBg,
    borderRadius: 12,
    marginBottom: 48,
    marginTop: 12,
    padding: 16,
  },
  deleteText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    marginVertical: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 45,
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  avatarImage: {
    borderRadius: 45,
    height: 90,
    width: 90,
  },
  avatarText: {
    color: COLORS.onPrimary,
    fontSize: 36,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 14,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  editNameButton: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editNameText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  childItem: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  childName: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  childAge: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing.sm,
  },
  childEmptyState: {
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 8,
  },
  childEmptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  childEmptyTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  childEmptyText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    marginVertical: theme.spacing.md,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  scoreCircle: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 60,
    height: 120,
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    width: 120,
  },
  scoreText: {
    color: theme.colors.primary,
    fontSize: 48,
    fontWeight: '700',
  },
  scoreDescription: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
  },
  sectionCard: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: COLORS.textFaint,
    fontSize: 13,
    marginBottom: 12,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  settingText: {
    flex: 1,
  },
  micRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
  },
  selectedStyle: {
    backgroundColor: theme.colors.primary,
  },
  micLabel: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 14,
  },
  micLabelSelected: {
    color: COLORS.onPrimary,
  },
  checkmark: {
    color: COLORS.onPrimary,
    fontSize: 16,
  },
  aboutCard: {
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    marginBottom: 16,
    padding: 18,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  aboutMeta: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  aboutTagline: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
  disclaimer: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 12,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    maxWidth: 360,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalInput: {
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 12,
    padding: 12,
  },
  multilineInput: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  photoButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  modalSecondaryButton: {
    borderColor: COLORS.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSecondaryText: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
  },
});
