import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  background: COLORS.background,
  text: COLORS.textPrimary,
  subtext: COLORS.textSecondary,
  muted: COLORS.textFaint,
  card: COLORS.cardBg,
  purple: COLORS.primary,
  purpleDark: COLORS.primaryDark,
  purpleSoft: COLORS.surfaceContainer,
  purpleAccent: COLORS.accent,
  grayPill: COLORS.surfaceContainer,
  danger: COLORS.error,
  border: COLORS.border,
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

function minutesAgo(value: any, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!value) return t('location_never_updated');
  const date = toReportDate(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return t('location_updated_now');
  if (minutes < 60) return t(minutes === 1 ? 'location_updated_minutes' : 'location_updated_minutes_plural', { count: minutes });
  const hours = Math.round(minutes / 60);
  return t(hours === 1 ? 'location_updated_hours' : 'location_updated_hours_plural', { count: hours });
}

function getInitial(name: string) {
  return name.trim()[0]?.toUpperCase() || 'C';
}

export default function ChildLocationScreen() {
  const { t } = useTranslation();
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
          setStatusMessage(t('location_permission_needed'));
        }
      })
      .catch((error) => {
        console.warn('Location permission request failed:', error);
        if (mounted) setStatusMessage(t('location_permission_failed'));
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
      setStatusMessage(t('location_select_child'));
      return;
    }

    try {
      const { status } =
        locationPermission === 'granted'
          ? { status: locationPermission }
          : await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      if (status !== 'granted') {
        setStatusMessage(t('location_permission_denied'));
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
      setStatusMessage(t('location_shared'));
      await loadChildren();
    } catch (error) {
      console.error('Share location failed:', error);
      setStatusMessage(t('location_share_failed'));
    }
  };

  const callParent = () => {
    const number = selectedChild?.emergencyContact;
    if (!number) {
      setStatusMessage(t('location_no_contact'));
      return;
    }
    Linking.openURL(`tel:${number}`).catch((error) => {
      console.warn('Phone dialer failed:', error);
      setStatusMessage(t('location_dialer_failed'));
    });
  };

  const focusChild = (child: ChildRecord) => {
    setSelectedChildId(child.id);
  };

  const refreshLocations = async () => {
    try {
      setStatusMessage(t('location_refreshing'));
      await loadChildren();
      setStatusMessage(t('location_refreshed'));
    } catch (error) {
      console.error('Refresh locations failed:', error);
      setStatusMessage(t('location_refresh_failed'));
    }
  };

  const showSafeZoneInfo = () => {
    Alert.alert(
      t('location_safe_zones'),
      t('location_safe_zones_message'),
      [{ text: t('coaching_ok') }]
    );
  };

  if (children.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('location_title')}</Text>
          <Text style={styles.subtitle}>{t('location_subtitle')}</Text>
        </View>

        <View style={styles.emptyState}>
          <ChildLocationIcon />
          <Text style={styles.emptyTitle}>{t('location_no_children')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('location_empty_text')}
          </Text>

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(drawer)/profile' as any)}>
            <Text style={styles.addButtonText}>{t('location_settings_add_child')}</Text>
          </TouchableOpacity>

          <View style={styles.privacyNote}>
            <MaterialIcons name="lock-outline" size={14} color={COLORS.success} />
            <Text style={styles.privacyText}>
              {t('location_privacy')}
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
        <Text style={styles.screenTitle}>{t('location_beta_title')}</Text>
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
          <Text style={styles.addPillText}>{t('location_add')}</Text>
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
              description: child.locationName || t('location_last_known'),
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
            <Text style={styles.pinLabelText}>{selectedChild?.name || t('history_default_child')}</Text>
            <MaterialIcons name="school" size={15} color={UI.purpleDark} />
          </View>
          <View style={styles.pinMarker}>
            <View style={styles.pinAvatar}>
              <Text style={styles.pinAvatarText}>{getInitial(selectedChild?.name || t('history_default_child'))}</Text>
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
          <Text style={styles.locationTitle}>{selectedChild?.locationName || t('location_default_place')}</Text>
        </View>

        <View style={styles.updatedRow}>
          <View style={styles.updatedDot} />
          <Text style={styles.updatedText}>
            {t('location_last_updated', {
              time: selectedChild?.lastLocation?.timestamp
                ? minutesAgo(selectedChild.lastLocation.timestamp, t).replace(/^Updated\\s/, '')
                : t('location_default_updated'),
            })}
          </Text>
        </View>

        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

        <View style={styles.locationActions}>
          <TouchableOpacity style={styles.shareButton} onPress={shareLocation} disabled={!selectedChild} activeOpacity={0.82}>
            <MaterialIcons name="ios-share" size={18} color={UI.text} />
            <Text style={styles.shareButtonText}>{t('location_share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callButton} onPress={callParent} activeOpacity={0.82}>
          <MaterialIcons name="phone" size={18} color={COLORS.onPrimary} />
            <Text style={styles.callButtonText}>{t('location_call')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={showSafeZoneInfo} activeOpacity={0.82}>
            <MaterialIcons name="add-location-alt" size={18} color={UI.text} />
            <Text style={styles.shareButtonText}>{t('location_set_safe_zone')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.insightsCard}>
        <Text style={styles.insightsTitle}>{t('location_coach_insights')}</Text>
        <Text style={styles.insightsText}>
          {t('location_insight_text', { name: selectedChild?.name || t('history_default_child') })}
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
    backgroundColor: UI.grayPill,
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
    backgroundColor: UI.purpleSoft,
  },
  pillAvatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pillAvatarTextActive: {
    color: COLORS.onPrimary,
  },
  pillAvatarTextInactive: {
    color: UI.text,
  },
  childPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  childPillTextActive: {
    color: COLORS.onPrimary,
  },
  childPillTextInactive: {
    color: UI.text,
  },
  addPill: {
    alignItems: 'center',
    borderColor: '#6D5591',
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
    backgroundColor: UI.card,
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
    backgroundColor: UI.card,
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
    borderColor: UI.card,
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
    color: COLORS.onPrimary,
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
    backgroundColor: UI.card,
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
    borderColor: UI.border,
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
    color: COLORS.onPrimary,
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
  privacyText: {
    color: COLORS.successText,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
