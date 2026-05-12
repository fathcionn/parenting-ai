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
  background: '#FCF8FF',
  border: '#E4E1ED',
  text: '#464554',
  primary: '#4F46E5',
  active: '#8B5CF6',
  activePill: '#E1E0FF',
  activePillText: '#6366F1',
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
    borderRightWidth: 1,
    borderRightColor: DRAWER_COLORS.border,
    shadowColor: '#312E81',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '10px 0px 35px rgba(49, 46, 129, 0.12)',
      } as any,
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: DRAWER_COLORS.border,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E1E0FF',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1E0FF',
  },
  avatarInitial: {
    color: DRAWER_COLORS.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  accountName: {
    color: DRAWER_COLORS.primary,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  accountPlan: {
    color: DRAWER_COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  statusPill: {
    marginTop: 10,
    backgroundColor: DRAWER_COLORS.activePill,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
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
    paddingTop: 22,
    paddingBottom: 22,
    gap: 14,
  },
  drawerItem: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  drawerItemActive: {
    backgroundColor: DRAWER_COLORS.active,
  },
  drawerItemIcon: {
    width: 34,
    textAlign: 'center',
  },
  drawerItemText: {
    color: DRAWER_COLORS.text,
    fontSize: 18,
    fontWeight: '500',
  },
  drawerItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: DRAWER_COLORS.border,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
  },
  logoutItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 4,
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
    backgroundColor: '#EFECF8',
  },
});

const drawerItems: Array<{
  label: string;
  route: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  materialIcon?: React.ComponentProps<typeof MaterialIcons>['name'];
}> = [
  { label: 'Dashboard', route: 'index', icon: 'grid-outline' },
  { label: 'Live Coaching', route: 'coaching', materialIcon: 'mic' },
  { label: 'Sessions', route: 'history', icon: 'time-outline' },
  { label: 'Insights', route: 'insights', icon: 'analytics-outline' },
  { label: 'Achievements', route: 'achievements', icon: 'trophy-outline' },
  { label: 'Child Location', route: 'child-location', icon: 'location-outline' },
  { label: 'Settings', route: 'profile', icon: 'settings-outline' },
];

function CustomDrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const router = useRouter();
  const appTheme = useAppTheme();
  const user = auth.currentUser;
  const profile = useAuthStore((store) => store.profile);
  const displayName = profile?.displayName || user?.displayName || 'Parent Account';
  const photoURL = user?.photoURL || profile?.photoURL;
  const activeRoute = state.routeNames[state.index];

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
            <Text style={styles.accountName}>Parent Account</Text>
            <Text style={[styles.accountPlan, { color: appTheme.colors.muted }]}>TalkWise Premium</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>Active Member</Text>
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
                  color={isActive ? '#FFFFFF' : appTheme.colors.text}
                    style={styles.drawerItemIcon}
                  />
                ) : (
                  <Ionicons
                    name={item.icon}
                    size={28}
                    color={isActive ? '#FFFFFF' : appTheme.colors.text}
                    style={styles.drawerItemIcon}
                  />
                )}
                <Text
                  style={[
                    styles.drawerItemText,
                    { color: appTheme.colors.text },
                    isActive && styles.drawerItemTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.drawerFooter, { borderTopColor: appTheme.colors.border }]}>
          <TouchableOpacity style={styles.logoutItem} onPress={handleLogout} activeOpacity={0.82}>
            <Ionicons name="log-out-outline" size={30} color={DRAWER_COLORS.danger} />
            <Text style={styles.logoutText}>Logout</Text>
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
          overlayColor: 'rgba(27, 27, 35, 0.35)',
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
              <MaterialIcons name="menu" size={24} color="#464554" />
            </TouchableOpacity>
          ),
          headerTintColor: Colors.text,
          drawerStyle: {
            backgroundColor: appTheme.colors.background,
            borderBottomRightRadius: 16,
            borderTopRightRadius: 16,
            borderRightColor: appTheme.colors.border,
            borderRightWidth: 1,
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
            title: 'TalkWise',
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
            drawerLabel: 'Community Benchmarks',
            title: 'Community Benchmarks',
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="trophy-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="achievements"
          options={{
            drawerLabel: 'Achievements',
            title: 'Achievements',
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="ribbon-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="child-location"
          options={{
            drawerLabel: 'Child Location',
            title: 'Child Location',
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
            title: 'Session Complete',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
