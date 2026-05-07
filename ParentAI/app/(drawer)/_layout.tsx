import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { Colors } from '../../src/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeaderLanguageButton } from '../../src/components/HeaderLanguageButton';
import { useTranslation } from 'react-i18next';

function DrawerIcon({ name, color, size }: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
}) {
  return (
    <Ionicons name={name} size={size} color={color} style={{ width: size, textAlign: 'center' }} />
  );
}

export default function DrawerLayout() {
  const { t } = useTranslation();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerActiveTintColor: Colors.primary,
          drawerInactiveTintColor: Colors.secondary,
          drawerActiveBackgroundColor: Colors.primaryFaded,
          drawerInactiveBackgroundColor: 'transparent',
          headerStyle: {
            backgroundColor: Colors.background,
            shadowColor: 'transparent',
            elevation: 0,
          },
          headerRight: () => <HeaderLanguageButton />,
          headerTintColor: Colors.text,
          drawerStyle: {
            backgroundColor: Colors.backgroundCard,
            borderBottomRightRadius: 16,
            borderTopRightRadius: 16,
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
        }}>
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
