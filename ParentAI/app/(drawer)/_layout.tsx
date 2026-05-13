import React from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeaderLanguageButton } from '../../src/components/HeaderLanguageButton';
import { useAppTheme } from '../../src/context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../src/config/firebase-config';
import { useAuthStore } from '../../src/stores/auth-store';

function DrawerIcon({ name, color, size }: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
}) {
  return (
    <Ionicons name={name} size={size} color={color} style={{ width: size, textAlign: 'center' }} />
  );
}

const DRAWER_COLORS = {
  background: '#FAF9FF',
  border: '#F1ECFB',
  text: '#1F2937',
  muted: '#6B7280',
  primary: '#5B21B6',
  primaryDark: '#4C1D95',
  active: '#5B21B6',
  activePill: '#F3EEFF',
  activePillText: '#5B21B6',
  softLilac: '#F5F2FF',
  danger: '#BA1A1A',
};

const styles = StyleSheet.create({
  drawerSafeArea: {
    flex: 1,
    backgroundColor: DRAWER_COLORS.background,
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: DRAWER_COLORS.background,
    borderRightWidth: 0,
    borderRightColor: DRAWER_COLORS.border,
    shadowColor: DRAWER_COLORS.primaryDark,
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '18px 0px 45px rgba(76, 29, 149, 0.10)',
      } as any,
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 30,
    borderBottomWidth: 0,
    borderBottomColor: DRAWER_COLORS.border,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: DRAWER_COLORS.activePill,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DRAWER_COLORS.activePill,
  },
  avatarInitial: {
    color: DRAWER_COLORS.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  accountName: {
    color: DRAWER_COLORS.primary,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  accountPlan: {
    color: DRAWER_COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  statusPill: {
    marginTop: 12,
    backgroundColor: DRAWER_COLORS.activePill,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  statusText: {
    color: DRAWER_COLORS.activePillText,
    fontSize: 13,
    fontWeight: '700',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerList: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 10,
  },
  drawerItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  drawerItemActive: {
    backgroundColor: DRAWER_COLORS.active,
    shadowColor: DRAWER_COLORS.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 28px rgba(76, 29, 149, 0.20)',
      } as any,
    }),
  },
  drawerItemIcon: {
    width: 34,
    textAlign: 'center',
  },
  drawerItemText: {
    color: DRAWER_COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  drawerItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: DRAWER_COLORS.border,
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 28,
  },
  logoutItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  logoutText: {
    color: DRAWER_COLORS.danger,
    fontSize: 18,
    fontWeight: '800',
  },
  headerMenuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: DRAWER_COLORS.softLilac,
  },
});

const drawerItems: Array<{
  labelKey: string;
  route: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  materialIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
}> = [
  { labelKey: 'drawer_dashboard', route: 'index', icon: 'grid-outline' },
  { labelKey: 'nav_live_coaching', route: 'coaching', materialIcon: 'mic' },
  { labelKey: 'drawer_sessions', route: 'history', icon: 'time-outline' },
  { labelKey: 'nav_insights', route: 'insights', icon: 'analytics-outline' },
  { labelKey: 'drawer_achievements', route: 'achievements', icon: 'trophy-outline' },
  { labelKey: 'drawer_child_location', route: 'child-location', icon: 'location-outline' },
  { labelKey: 'common.settings', route: 'profile', icon: 'settings-outline' },
];

function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const appTheme = useAppTheme();
  const user = auth.currentUser;
  const profile = useAuthStore((store) => store.profile);
  const displayName = profile?.displayName || user?.displayName || t('drawer_parent_account');
  const photoURL = user?.photoURL || profile?.photoURL;
  const activeRoute = state.routeNames[state.index];

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

  return (
    <SafeAreaView style={[styles.drawerSafeArea, { backgroundColor: appTheme.colors.background }]}>
      <View
        style={[
          styles.drawerContainer,
          { backgroundColor: appTheme.colors.background, borderRightColor: appTheme.colors.border },
        ]}
      >
        <View style={[styles.drawerHeader, { borderBottomColor: appTheme.colors.border }]}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.accountName}>{t('drawer_parent_account')}</Text>
            <Text style={[styles.accountPlan, { color: DRAWER_COLORS.muted }]}>{t('drawer_premium')}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{t('drawer_active_member')}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerList}
          showsVerticalScrollIndicator={false}
        >
          {drawerItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                onPress={() => navigation.navigate(item.route as never)}
                activeOpacity={0.82}
              >
                {item.materialIcon ? (
                  <MaterialIcons
                    name={item.materialIcon}
                    size={28}
                  color={isActive ? '#FFFFFF' : DRAWER_COLORS.text}
                    style={styles.drawerItemIcon}
                  />
                ) : (
                  <Ionicons
                    name={item.icon}
                    size={28}
                    color={isActive ? '#FFFFFF' : DRAWER_COLORS.text}
                    style={styles.drawerItemIcon}
                  />
                )}
                <Text
                  style={[
                    styles.drawerItemText,
                    { color: DRAWER_COLORS.text },
                    isActive && styles.drawerItemTextActive,
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.drawerFooter, { borderTopColor: appTheme.colors.border }]}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout} activeOpacity={0.82}>
            <Ionicons name="log-out-outline" size={30} color={DRAWER_COLORS.danger} />
            <Text style={styles.logoutText}>{t('common_logout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function DrawerLayout() {
  const { t } = useTranslation();
  const appTheme = useAppTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        defaultStatus="closed"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={({ navigation }) => ({
          drawerType: 'front',
          headerShown: true,
          overlayColor: 'rgba(31, 41, 55, 0.30)',
          swipeEnabled: true,
          drawerActiveTintColor: Colors.primary,
          drawerInactiveTintColor: Colors.secondary,
          drawerActiveBackgroundColor: Colors.primaryFaded,
          drawerInactiveBackgroundColor: 'transparent',
          headerTitle: '',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: appTheme.colors.background,
            borderBottomWidth: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
          },
          headerRight: () => <HeaderLanguageButton />,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerMenuButton}
              activeOpacity={0.82}
              onPress={() => navigation.openDrawer()}
            >
              <MaterialIcons name="menu" size={24} color={DRAWER_COLORS.primary} />
            </TouchableOpacity>
          ),
          headerTintColor: Colors.text,
          drawerStyle: {
            backgroundColor: appTheme.colors.background,
            borderBottomRightRadius: 32,
            borderTopRightRadius: 32,
            borderRightColor: appTheme.colors.border,
            borderRightWidth: 0,
            width: 300,
          },
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '700',
          },
          drawerItemStyle: {
            borderRadius: 999,
            marginHorizontal: 10,
            marginVertical: 4,
          },
        })}>
        <Drawer.Screen
          name="index"
          options={{
            drawerLabel: t('nav_home'),
            title: t('app_name'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="coaching"
          options={{
            drawerLabel: t('nav_live_coaching'),
            title: t('nav_live_coaching'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="mic-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="insights"
          options={{
            drawerLabel: t('nav_insights'),
            title: t('nav_insights'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="bar-chart-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="history"
          options={{
            drawerLabel: t('nav_history'),
            title: t('nav_history'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="time-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            drawerLabel: t('nav_profile'),
            title: t('profile_title'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="person-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="leaderboard"
          options={{
            drawerLabel: t('drawer_community_benchmarks'),
            title: t('drawer_community_benchmarks'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="trophy-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="achievements"
          options={{
            drawerLabel: t('drawer_achievements'),
            title: t('drawer_achievements'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="ribbon-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="child-location"
          options={{
            drawerLabel: t('drawer_child_location'),
            title: t('drawer_child_location'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="location-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="report-detail"
          options={{
            drawerItemStyle: { display: 'none' },
            title: t('history_view_report'),
          }}
        />
        <Drawer.Screen
          name="reports"
          options={{
            drawerItemStyle: { display: 'none' },
            title: t('nav_insights'),
          }}
        />
        <Drawer.Screen
          name="record"
          options={{
            drawerItemStyle: { display: 'none' },
            title: t('nav_live_coaching'),
          }}
        />
        <Drawer.Screen
          name="session-results"
          options={{
            drawerItemStyle: { display: 'none' },
            title: t('drawer_session_complete'),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
