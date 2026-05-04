import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase-config';
import { useAuthStore } from '../stores/auth-store';
import { theme } from '../styles/theme';
import { Container, Card } from '../components/Layout';
import { Button } from '../components/Button';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../services/storageKeys';

export const ProfileScreen: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, user, logout } = useAuthStore();
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('default');

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
    Alert.alert(t('common_logout'), t('common_are_you_sure'), [
      {
        text: t('common_cancel'),
        onPress: () => {},
        style: 'cancel',
      },
      {
        text: t('common_logout'),
        onPress: async () => {
          try {
            await signOut(auth);
            logout();
            router.replace('/login');
          } catch (error) {
            Alert.alert(t('common_error'), t('common_failed_logout'));
          }
        },
        style: 'destructive',
      },
    ]);
  };

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
        <Button title={t('profile_add_child')} onPress={() => {}} variant="outline" fullWidth />
      </Card>

      <Card title={t('profile_parenting_score')}>
        <View style={styles.scoreContainer}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreText}>{profile?.parentingScore || 0}</Text>
          </View>
          <Text style={styles.scoreDescription}>{t('profile_score_subtitle')}</Text>
        </View>
      </Card>

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
});
