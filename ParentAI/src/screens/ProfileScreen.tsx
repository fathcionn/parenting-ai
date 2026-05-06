import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, Modal, TextInput, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../config/firebase-config';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { Container, Card } from '../components/Layout';
import { Button } from '../components/Button';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';
import { useAppTheme } from '../context/ThemeContext';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, user, updateProfile } = useAuthStore();
  const { isDarkMode, setDarkMode, colors } = useAppTheme();
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('default');
  const [showChildModal, setShowChildModal] = useState(false);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [childPhotoUri, setChildPhotoUri] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [safeZoneRadius, setSafeZoneRadius] = useState('500');

  useEffect(() => {
    async function loadMics() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices.filter((device) => device.kind === 'audioinput');
        setMicrophones(mics);

        const saved = await getStorageItem(STORAGE_KEYS.micId);
        if (saved) setSelectedMicId(saved);
      } catch (err) {
        console.error('Could not load microphones:', err);
      }
    }

    loadMics();
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
    await setStorageItem(STORAGE_KEYS.micId, deviceId);
  }

  return (
    <Container scroll>
      <Card title={t('profile_edit')}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.displayName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{profile?.displayName || t('common_user')}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.joinDate}>
              {t('common_member_since')} {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : t('common_recently')}
            </Text>
          </View>
        </View>
      </Card>

      <Card title={t('profile_child_profile')}>
        {profile?.children && profile.children.length > 0 ? (
          profile.children.map((child) => (
            <View key={child.id} style={styles.childItem}>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.childAge}>{child.age}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t('profile_no_children')}</Text>
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
            <Text style={styles.scoreText}>{profile?.parentingScore || 0}</Text>
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🎙️ {t('profile_microphone')}</Text>
        <Text style={styles.sectionSubtitle}>{t('profile_mic_subtitle')}</Text>

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

      <Button title={t('profile_sign_out')} onPress={handleLogout} variant="outline" fullWidth />

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
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.lg,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.background,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '700',
    color: theme.colors.text,
  },
  email: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  joinDate: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  childItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  childName: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text,
  },
  childAge: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  scoreContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  scoreDescription: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
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
    padding: 20,
    width: '100%',
    maxWidth: 360,
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

