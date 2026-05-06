import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { signOut, updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../config/firebase-config';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { Container, Card } from '../components/Layout';
import { Button } from '../components/Button';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useAppTheme } from '../context/ThemeContext';
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

  const displayName =
    profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'TalkWise User';
  const email = user?.email || profile?.email || '';
  const avatarUrl = profile?.photoURL || user?.photoURL || '';
  const avatarInitial = displayName.trim()[0]?.toUpperCase() || 'T';

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

  return (
    <Container scroll>
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
        {profile?.children && profile.children.length > 0 ? (
          profile.children.map((child) => (
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
            trackColor={{ false: '#DADADA', true: '#111111' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <Card title={t('profile_leaderboard')}>
        <Button
          title={profile?.isAnonymous ? t('profile_leaderboard') : t('profile_stay_anonymous')}
          onPress={() => {}}
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

      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Display name"
              placeholderTextColor="#888"
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
              placeholderTextColor="#888"
              style={styles.modalInput}
            />
            <TextInput
              value={childAge}
              onChangeText={setChildAge}
              placeholder="Age"
              placeholderTextColor="#888"
              keyboardType="numeric"
              style={styles.modalInput}
            />
            <TextInput
              value={physicalDescription}
              onChangeText={setPhysicalDescription}
              placeholder="Physical description"
              placeholderTextColor="#888"
              style={styles.modalInput}
            />
            <TextInput
              value={emergencyContact}
              onChangeText={setEmergencyContact}
              placeholder="Emergency contact number"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              style={styles.modalInput}
            />
            <TextInput
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              placeholder="Medical notes / allergies"
              placeholderTextColor="#888"
              multiline
              style={[styles.modalInput, styles.multilineInput]}
            />
            <TextInput
              value={schoolName}
              onChangeText={setSchoolName}
              placeholder="School name"
              placeholderTextColor="#888"
              style={styles.modalInput}
            />
            <TextInput
              value={safeZoneRadius}
              onChangeText={setSafeZoneRadius}
              placeholder="Safe zone radius in meters"
              placeholderTextColor="#888"
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
  avatarSection: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: theme.spacing.md,
    padding: 22,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#000',
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
    color: '#FFF',
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
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  editNameText: {
    color: '#000',
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
    borderRadius: 14,
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
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
  },
  childEmptyText: {
    color: '#777',
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
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#888',
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
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    padding: 12,
  },
  selectedStyle: {
    backgroundColor: '#000',
  },
  micLabel: {
    color: '#000',
    flex: 1,
    fontSize: 14,
  },
  micLabelSelected: {
    color: '#FFF',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 16,
  },
  aboutCard: {
    borderRadius: 16,
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
    backgroundColor: '#FFF',
    borderRadius: 16,
    maxWidth: 360,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalInput: {
    borderColor: '#E5E5E5',
    borderRadius: 10,
    borderWidth: 1,
    color: '#000',
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
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  photoButtonText: {
    color: '#000',
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
    borderColor: '#DADADA',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSecondaryText: {
    color: '#000',
    fontWeight: '700',
  },
  modalPrimaryButton: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: '#FFF',
    fontWeight: '800',
  },
});
