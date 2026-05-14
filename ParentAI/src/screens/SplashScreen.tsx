import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export function SplashScreen() {
  const { t } = useTranslation();
  return (
    <LinearGradient colors={['#4648D4', '#6B38D4']} style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.logoContainer}>
          <MaterialIcons name="family-restroom" size={64} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>TalkWise</Text>
        <Text style={styles.subtitle}>{t('splash_subtitle')}</Text>
      </View>

      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.loadingText}>{t('splash_loading')}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    shadowColor: '#1B1B23',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 22px 50px rgba(27, 27, 35, 0.22)',
        backdropFilter: 'blur(18px)',
      } as any,
    }),
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingWrap: {
    position: 'absolute',
    bottom: 74,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: 'rgba(225, 224, 255, 0.8)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default SplashScreen;
