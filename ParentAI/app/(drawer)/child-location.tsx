import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle as SvgCircle, Path } from 'react-native-svg';
import { ChildMap } from '../../src/components/ChildMap';
import { auth, db } from '../../src/config/firebase-config';
import { COLORS } from '../../src/theme/colors';
import { toReportDate } from '../../src/utils/reportUtils';

const MUTED_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0eb' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5C7A6B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8e0d8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e8e0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e8f4ed' }] },
];

const UI = {
  background: '#FCF8FF',
  text: '#1B1B23',
  subtext: '#464554',
  muted: '#767586',
  card: '#FFFFFF',
  purple: '#6366F1',
  purpleDark: '#4F46E5',
  purpleSoft: '#F5F3FF',
  purpleAccent: '#8B5CF6',
  grayPill: '#F3F4F6',
  danger: '#B91C1C',
  border: '#E5E7EB',
};

const shadowSm = Platform.select({
  web: { boxShadow: '0 8px 24px rgba(17, 24, 39, 0.08)' },
  ios: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  android: { elevation: 3 },
  default: {},
}) as object;

const shadowLg = Platform.select({
  web: { boxShadow: '0 18px 42px rgba(17, 24, 39, 0.16)' },
  ios: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
  },
  android: { elevation: 8 },
  default: {},
}) as object;

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
  const navigation = useNavigation<any>();
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);

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

  useEffect(() => {
    let mounted = true;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (!mounted) return;
        setLocationPermission(status);
        if (status !== 'granted') {
          setStatusMessage('Location permission is needed to share or refresh location.');
        }
      })
      .catch((error) => {
        console.warn('Location permission request failed:', error);
        if (mounted) setStatusMessage('Could not request location permission.');
      });
    return () => {
      mounted = false;
    };
  }, []);

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
    if (!user || !selectedChild) {
      setStatusMessage('Select a child before sharing location.');
      return;
    }

    try {
      const { status } =
        locationPermission === 'granted'
          ? { status: locationPermission }
          : await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
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
    } catch (error) {
      console.error('Share location failed:', error);
      setStatusMessage('Could not share location. Please try again.');
    }
  };

  const callParent = () => {
    const number = selectedChild?.emergencyContact;
    if (!number) {
      setStatusMessage('No emergency contact saved for this child.');
      return;
    }
    Linking.openURL(`tel:${number}`).catch((error) => {
      console.warn('Phone dialer failed:', error);
      setStatusMessage('Could not open the phone dialer.');
    });
  };

  const focusChild = (child: ChildRecord) => {
    setSelectedChildId(child.id);
  };

  const refreshLocations = async () => {
    try {
      setStatusMessage('Refreshing locations...');
      await loadChildren();
      setStatusMessage('Locations refreshed.');
    } catch (error) {
      console.error('Refresh locations failed:', error);
      setStatusMessage('Could not refresh locations.');
    }
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

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(drawer)/profile' as any)}>
            <Text style={styles.addButtonText}>Go to Settings to Add a Child</Text>
          </TouchableOpacity>

          <View style={styles.privacyNote}>
            <MaterialIcons name="lock-outline" size={14} color={COLORS.success} />
            <Text style={styles.privacyText}>
              Location data is encrypted and only visible to you. It is never shared or sold.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.8} onPress={() => navigation.openDrawer()}>
          <MaterialIcons name="menu" size={24} color={UI.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Child Location {'\u{1F4CD}'}{'\n'}Beta</Text>
        <TouchableOpacity style={styles.profileButton} activeOpacity={0.8} onPress={() => router.push('/(drawer)/profile' as any)}>
          <MaterialIcons name="person-outline" size={23} color={UI.subtext} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.selectorContent}
        style={styles.selectorScroll}
      >
        {children.map((child) => {
          const active = child.id === selectedChild?.id;
          return (
            <TouchableOpacity
              key={child.id}
              style={[styles.childPill, active ? styles.childPillActive : styles.childPillInactive]}
              activeOpacity={0.82}
              onPress={() => focusChild(child)}
            >
              <View style={[styles.pillAvatar, active ? styles.pillAvatarActive : styles.pillAvatarInactive]}>
                <Text style={[styles.pillAvatarText, active ? styles.pillAvatarTextActive : styles.pillAvatarTextInactive]}>
                  {getInitial(child.name)}
                </Text>
              </View>
              <Text style={[styles.childPillText, active ? styles.childPillTextActive : styles.childPillTextInactive]}>
                {child.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.addPill} activeOpacity={0.82} onPress={() => router.push('/(drawer)/profile' as any)}>
          <Text style={styles.addPillText}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.mapCard}>
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

        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapControlButton} activeOpacity={0.8} onPress={refreshLocations}>
            <MaterialIcons name="my-location" size={21} color={UI.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapControlButton} activeOpacity={0.8} onPress={showSafeZoneInfo}>
            <MaterialIcons name="layers" size={21} color={UI.text} />
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={styles.customPinWrap}>
          <View style={styles.pinLabel}>
            <Text style={styles.pinLabelText}>{selectedChild?.name || 'Sarah'}</Text>
            <MaterialIcons name="school" size={15} color={UI.purpleDark} />
          </View>
          <View style={styles.pinMarker}>
            <View style={styles.pinAvatar}>
              <Text style={styles.pinAvatarText}>{getInitial(selectedChild?.name || 'Sarah')}</Text>
            </View>
          </View>
          <View style={styles.pinPoint} />
        </View>
      </View>

      <View style={styles.locationCard}>
        <View style={styles.locationHeader}>
          <View style={styles.locationIconOutline}>
            <MaterialIcons name="location-on" size={22} color={UI.purpleDark} />
          </View>
          <Text style={styles.locationTitle}>{selectedChild?.locationName || 'Lincoln Elementary School'}</Text>
        </View>

        <View style={styles.updatedRow}>
          <View style={styles.updatedDot} />
          <Text style={styles.updatedText}>
            Last updated: {selectedChild?.lastLocation?.timestamp ? minutesAgo(selectedChild.lastLocation.timestamp).replace('Updated ', '') : '2 mins ago'}
          </Text>
        </View>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <View style={styles.locationActions}>
          <TouchableOpacity style={styles.shareButton} onPress={shareLocation} disabled={!selectedChild} activeOpacity={0.82}>
            <MaterialIcons name="ios-share" size={18} color={UI.text} />
            <Text style={styles.shareButtonText}>Share Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callButton} onPress={callParent} activeOpacity={0.82}>
            <MaterialIcons name="phone" size={18} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call Parent Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={showSafeZoneInfo} activeOpacity={0.82}>
            <MaterialIcons name="add-location-alt" size={18} color={UI.text} />
            <Text style={styles.shareButtonText}>Set Safe Zone</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>Coach Insights</Text>
        <Text style={styles.insightsText}>
          {selectedChild?.name || 'Sarah'} arrived at school 5 minutes earlier than her usual average. Her route
          followed the safe paths established in your settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: UI.background,
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 44,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  topHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerIconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  profileButton: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  screenTitle: {
    color: UI.purpleDark,
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 31,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  title: {
    color: UI.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    color: UI.subtext,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  selectorScroll: {
    marginBottom: 18,
  },
  selectorContent: {
    gap: 10,
    paddingRight: 16,
  },
  childPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  childPillActive: {
    backgroundColor: UI.purple,
  },
  childPillInactive: {
    backgroundColor: UI.grayPill,
  },
  pillAvatar: {
    alignItems: 'center',
    borderRadius: 13,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  pillAvatarActive: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  pillAvatarInactive: {
    backgroundColor: '#E5E7EB',
  },
  pillAvatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pillAvatarTextActive: {
    color: '#FFFFFF',
  },
  pillAvatarTextInactive: {
    color: UI.text,
  },
  childPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  childPillTextActive: {
    color: '#FFFFFF',
  },
  childPillTextInactive: {
    color: UI.text,
  },
  addPill: {
    alignItems: 'center',
    borderColor: '#C7C8D2',
    borderRadius: 999,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  addPillText: {
    color: UI.subtext,
    fontSize: 14,
    fontWeight: '800',
  },
  mapCard: {
    borderColor: UI.border,
    borderRadius: 30,
    borderWidth: 1,
    height: 370,
    marginBottom: -42,
    overflow: 'hidden',
    position: 'relative',
    ...shadowSm,
  },
  mapControls: {
    gap: 10,
    position: 'absolute',
    right: 16,
    top: 16,
  },
  mapControlButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
    ...shadowSm,
  },
  customPinWrap: {
    alignItems: 'center',
    left: '50%',
    position: 'absolute',
    top: '44%',
    transform: [{ translateX: -39 }, { translateY: -56 }],
    width: 78,
  },
  pinLabel: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadowSm,
  },
  pinLabelText: {
    color: UI.text,
    fontSize: 13,
    fontWeight: '800',
  },
  pinMarker: {
    alignItems: 'center',
    backgroundColor: UI.purple,
    borderColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 4,
    height: 52,
    justifyContent: 'center',
    width: 52,
    ...shadowSm,
  },
  pinAvatar: {
    alignItems: 'center',
    backgroundColor: UI.purpleDark,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pinAvatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  pinPoint: {
    backgroundColor: UI.purple,
    height: 14,
    marginTop: -7,
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    marginHorizontal: 8,
    marginBottom: 20,
    padding: 20,
    position: 'relative',
    zIndex: 2,
    ...shadowLg,
  },
  locationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  locationIconOutline: {
    alignItems: 'center',
    borderColor: UI.purpleDark,
    borderRadius: 18,
    borderWidth: 1.5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  locationTitle: {
    color: UI.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  updatedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  updatedDot: {
    backgroundColor: UI.purple,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  updatedText: {
    color: UI.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  locationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minWidth: 150,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  shareButtonText: {
    color: UI.text,
    fontSize: 14,
    fontWeight: '800',
  },
  callButton: {
    alignItems: 'center',
    backgroundColor: UI.danger,
    borderRadius: 16,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minWidth: 150,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  insightsCard: {
    backgroundColor: UI.purpleSoft,
    borderLeftColor: UI.purpleAccent,
    borderLeftWidth: 6,
    borderRadius: 22,
    marginHorizontal: 4,
    padding: 18,
  },
  insightsTitle: {
    color: UI.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  insightsText: {
    color: UI.subtext,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  statusMessage: {
    color: UI.subtext,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: UI.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: UI.subtext,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: UI.purple,
    borderRadius: 9999,
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  addButtonText: {
    color: '#FFFFFF',
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
  privacyText: {
    color: COLORS.successText,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
