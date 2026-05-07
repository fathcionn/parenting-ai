import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase-config';
import { toReportDate } from '../../src/utils/reportUtils';
import { COLORS } from '../../src/theme/colors';
import { ChildMap } from '../../src/components/ChildMap';

const MUTED_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0eb' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5C7A6B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8e0d8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e8e0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f4ed' }] },
];

type ChildLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp?: any;
};

type SafeZone = {
  latitude: number;
  longitude: number;
  radius?: number;
};

type ChildRecord = {
  id: string;
  name: string;
  emergencyContact?: string;
  lastLocation?: ChildLocation | null;
  locationName?: string;
  battery?: number;
  safeZone?: SafeZone | null;
};

function ChildLocationIcon() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <Path
        d="M40 8C28.95 8 20 16.95 20 28C20 42 40 68 40 68C40 68 60 42 60 28C60 16.95 51.05 8 40 8Z"
        fill="#EDE8E3"
        stroke="#5C7A6B"
        strokeWidth="2.5"
      />
      <SvgCircle cx="40" cy="28" r="8" fill="#5C7A6B" opacity="0.7" />
      <SvgCircle cx="40" cy="24" r="4" fill="#5C7A6B" />
      <Path
        d="M33 36C33 32 36 30 40 30C44 30 47 32 47 36"
        stroke="#5C7A6B"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function minutesAgo(value: any) {
  if (!value) return 'Never updated';
  const date = toReportDate(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function getInitial(name: string) {
  return name.trim()[0]?.toUpperCase() || 'C';
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
      const lastLocation = data.lastLocation || null;
      return {
        id: item.id,
        name: String(data.name || 'Child'),
        emergencyContact: data.emergencyContact || '',
        lastLocation,
        locationName: data.locationName || data.lastLocationName || '',
        battery: Number.isFinite(Number(data.battery)) ? Number(data.battery) : 100,
        safeZone:
          data.safeZone ||
          (lastLocation && data.safeZoneRadius
            ? {
                latitude: lastLocation.latitude,
                longitude: lastLocation.longitude,
                radius: Number(data.safeZoneRadius) || 500,
              }
            : null),
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
    () => children.find((child) => child.id === selectedChildId) || children[0] || null,
    [children, selectedChildId]
  );

  const region = selectedChild?.lastLocation
    ? {
        latitude: selectedChild.lastLocation.latitude,
        longitude: selectedChild.lastLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 41.0082,
        longitude: 28.9784,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      };

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

  const focusChild = (child: ChildRecord) => {
    setSelectedChildId(child.id);
  };

  const showSafeZoneInfo = () => {
    Alert.alert(
      'Safe Zones',
      'Define home, school, or custom zones to get arrival and departure alerts. Coming soon.',
      [{ text: 'OK' }]
    );
  };

  if (children.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Child Location</Text>
          <Text style={styles.subtitle}>Track your child's device location and set safe zones.</Text>
        </View>

        <View style={styles.emptyState}>
          <ChildLocationIcon />
          <Text style={styles.emptyTitle}>No children added yet</Text>
          <Text style={styles.emptySubtitle}>
            Add your child's device to see their real-time location and receive arrival updates when they reach
            home, school, or any safe zone you set.
          </Text>

          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/profile' as any)}>
            <Text style={styles.addButtonText}>Go to Settings to Add a Child</Text>
          </TouchableOpacity>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>
              Location data is encrypted and only visible to you. It is never shared or sold.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCompact}>
        <Text style={styles.title}>Child Location</Text>
        <Text style={styles.subtitle}>Track your child's device location and set safe zones.</Text>
      </View>

      <View style={styles.mapSection}>
        <ChildMap
          region={region}
          customMapStyle={MUTED_MAP_STYLE}
          markers={children
            .filter((child) => child.lastLocation)
            .map((child) => ({
              id: child.id,
              latitude: child.lastLocation!.latitude,
              longitude: child.lastLocation!.longitude,
              title: child.name,
              description: child.locationName || 'Last known location',
            }))}
          safeZones={children
            .filter((child) => child.safeZone)
            .map((child) => ({
              id: child.id,
              latitude: child.safeZone!.latitude,
              longitude: child.safeZone!.longitude,
              radius: child.safeZone!.radius || 500,
            }))}
        />

        <TouchableOpacity style={styles.mapFab} onPress={() => router.push('/profile' as any)}>
          <Text style={styles.mapFabText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Children</Text>
          <Text style={styles.connectedLabel}>{children.length} connected</Text>
        </View>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardList}>
          {children.map((child) => {
            const battery = Math.max(0, Math.min(100, child.battery ?? 100));
            const lowBattery = battery <= 20;
            return (
              <View key={child.id} style={styles.childCard}>
                <View style={styles.childRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitial(child.name)}</Text>
                  </View>
                  <Text style={styles.childName}>{child.name}</Text>
                  <View style={[styles.batteryPill, lowBattery ? styles.batteryLow : styles.batteryOk]}>
                    <Text style={[styles.batteryText, lowBattery && styles.batteryTextLow]}>🔋 {battery}%</Text>
                  </View>
                </View>

                <Text style={styles.locationText}>
                  📍 {child.locationName || (child.lastLocation ? 'Last known location' : 'Location not shared yet')}
                </Text>
                <Text style={styles.lastUpdated}>{minutesAgo(child.lastLocation?.timestamp)}</Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.outlineButton} onPress={() => focusChild(child)}>
                    <Text style={styles.outlineButtonText}>View on Map</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineButton} onPress={showSafeZoneInfo}>
                    <Text style={styles.outlineButtonText}>Set Safe Zone</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityButton} onPress={shareLocation} disabled={!selectedChild}>
              <Text style={styles.utilityButtonText}>Share My Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.emergencyButton} onPress={callParent}>
              <Text style={styles.emergencyButtonText}>Call Parent Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  headerCompact: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 14,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  addButtonText: {
    color: COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  privacyNote: {
    alignItems: 'flex-start',
    backgroundColor: COLORS.successBg,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    maxWidth: 300,
    padding: 12,
  },
  privacyIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  privacyText: {
    color: COLORS.successText,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  mapSection: {
    flex: 0.55,
    overflow: 'hidden',
  },
  mapFab: {
    alignItems: 'center',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 9999,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
    width: 48,
  },
  mapFabText: {
    color: COLORS.onPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  cardsSection: {
    backgroundColor: COLORS.background,
    flex: 0.45,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  connectedLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardList: {
    paddingBottom: 28,
  },
  childCard: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  childRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceContainer,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  childName: {
    color: COLORS.textPrimary,
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
  },
  batteryPill: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  batteryOk: {
    backgroundColor: COLORS.successBg,
  },
  batteryLow: {
    backgroundColor: COLORS.errorBg,
  },
  batteryText: {
    color: COLORS.successText,
    fontSize: 12,
    fontWeight: '700',
  },
  batteryTextLow: {
    color: COLORS.error,
  },
  locationText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 14,
  },
  lastUpdated: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  outlineButton: {
    alignItems: 'center',
    borderColor: COLORS.borderStrong,
    borderRadius: 9999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusMessage: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  utilityButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    flex: 1,
    paddingVertical: 12,
  },
  utilityButtonText: {
    color: COLORS.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  emergencyButton: {
    alignItems: 'center',
    backgroundColor: COLORS.errorBg,
    borderRadius: 9999,
    flex: 1,
    paddingVertical: 12,
  },
  emergencyButtonText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '800',
  },
});
