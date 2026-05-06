import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Drawer } from 'expo-router/drawer';
import { theme } from '../../src/styles/theme';
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
          headerStyle: {
            backgroundColor: Colors.background,
            shadowColor: 'transparent', // remove header shadow
            elevation: 0,
          },
          headerRight: () => <HeaderLanguageButton />,
          headerTintColor: Colors.text,
          drawerStyle: {
            backgroundColor: Colors.backgroundLight,
            width: 280,
          },
          drawerLabelStyle: {
            fontSize: 16,
            fontWeight: '600',
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
          name="record"
          options={{
            drawerLabel: t('nav_live_coaching'),
            title: t('nav_live_coaching'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="mic-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="reports"
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
            drawerLabel: t('profile_leaderboard'),
            title: t('profile_leaderboard'),
            drawerIcon: ({ color, size }) => (
              <DrawerIcon name="trophy-outline" color={color} size={size} />
            ),
          }}
        />
        <Drawer.Screen
          name="child-location"
          options={{
            drawerLabel: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: Colors.secondary, fontSize: 16, fontWeight: '600' }}>
                  Child Location
                </Text>
                <View style={{ backgroundColor: '#000', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>BETA</Text>
                </View>
              </View>
            ),
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
