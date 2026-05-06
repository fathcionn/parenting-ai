import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase-config';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';
import { toReportDate } from '../../src/utils/reportUtils';
import { ChildMap } from '../../src/components/ChildMap';

type ChildLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: any;
};

type ChildRecord = {
  id: string;
  name: string;
  emergencyContact?: string;
  lastLocation?: ChildLocation | null;
};

function minutesAgo(value: any) {
  if (!value) return 'Never';
  const date = toReportDate(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

export default function ChildLocationScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const loadChildren = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snapshot = await getDocs(
      query(collection(db, 'users', user.uid, 'children'), orderBy('createdAt', 'desc'))
    );
    const nextChildren = snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name || 'Child'),
        emergencyContact: data.emergencyContact || '',
        lastLocation: data.lastLocation || null,
      };
    });
    setChildren(nextChildren);
    setSelectedChildId((current) => current || nextChildren[0]?.id || null);
  }, []);

  useEffect(() => {
    loadChildren();
    const interval = setInterval(loadChildren, 30000);
    return () => clearInterval(interval);
  }, [loadChildren]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId]
  );

  const shareLocation = async () => {
    const user = auth.currentUser;
    if (!user || !selectedChild) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setStatusMessage('Location permission was denied.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    await setDoc(
      doc(db, 'users', user.uid, 'children', selectedChild.id),
      {
        lastLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: serverTimestamp(),
          accuracy: location.coords.accuracy,
        },
      },
      { merge: true }
    );
    setStatusMessage('Location shared successfully.');
    await loadChildren();
  };

  const callParent = () => {
    const number = selectedChild?.emergencyContact;
    if (!number) {
      setStatusMessage('No emergency contact saved for this child.');
      return;
    }
    Linking.openURL(`tel:${number}`);
  };

  const region = selectedChild?.lastLocation
    ? {
        latitude: selectedChild.lastLocation.latitude,
        longitude: selectedChild.lastLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

  if (children.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Child Location</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>Beta</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Manual location sharing for future child device support.</Text>

        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👶</Text>
          <Text style={styles.emptyTitle}>No children added yet</Text>
          <Text style={styles.emptyText}>Add a child profile to track location</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/profile' as any)}>
            <Text style={styles.emptyButtonText}>Add Child</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Child Location</Text>
        <View style={styles.betaBadge}>
          <Text style={styles.betaText}>Beta</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Manual location sharing for future child device support.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childTabs}>
        {children.map((child) => {
          const selected = selectedChildId === child.id;
          return (
            <TouchableOpacity
              key={child.id}
              style={[styles.childPill, selected && styles.childPillActive]}
              onPress={() => setSelectedChildId(child.id)}
            >
              <Text style={selected ? styles.childPillTextActive : styles.childPillText}>{child.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.mapCard}>
        <ChildMap
          region={region}
          marker={
            selectedChild?.lastLocation
              ? {
                  latitude: selectedChild.lastLocation.latitude,
                  longitude: selectedChild.lastLocation.longitude,
                  title: selectedChild.name,
                }
              : null
          }
        />
      </View>

      <Text style={styles.lastUpdated}>
        Last updated: {minutesAgo(selectedChild?.lastLocation?.timestamp)}
      </Text>

      {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

      <TouchableOpacity style={styles.primaryButton} onPress={shareLocation} disabled={!selectedChild}>
        <Text style={styles.primaryButtonText}>Share My Location</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.emergencyButton} onPress={callParent}>
        <Text style={styles.emergencyButtonText}>Call Parent Now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.background, flex: 1 },
  content: { paddingBottom: Spacing.xxl, paddingHorizontal: Spacing.lg, paddingTop: 60 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  title: { ...Typography.h1, color: Colors.text },
  betaBadge: { backgroundColor: '#000', borderRadius: BorderRadius.round, paddingHorizontal: 10, paddingVertical: 5 },
  betaText: { color: '#FFF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 6 },
  childTabs: { marginVertical: 18 },
  childPill: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  childPillActive: { backgroundColor: '#000', borderColor: '#000' },
  childPillText: { color: '#000', fontSize: 13, fontWeight: '700' },
  childPillTextActive: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  mapCard: {
    backgroundColor: '#FFF',
    borderColor: '#E5E5E5',
    borderRadius: 18,
    borderWidth: 1,
    height: 300,
    overflow: 'hidden',
  },
  lastUpdated: { color: '#777', fontSize: 13, fontWeight: '700', marginTop: 12 },
  statusMessage: { color: '#000', fontSize: 14, fontWeight: '700', marginTop: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#000', borderRadius: 14, marginTop: 20, paddingVertical: 15 },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  emergencyButton: {
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 15,
  },
  emergencyButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '900' },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderColor: '#E5E5E5',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 36,
    padding: 28,
  },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { color: '#000', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#777', fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  emptyButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
});
