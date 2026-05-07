import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, colors } from '../theme/colors';
import { radius, spacing, shadows } from '../theme/spacing';
import { typeScale } from '../theme/typography';

export function SplashScreen() {
  return (
    <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.container}>
      <View style={styles.iconCard}>
        <FontAwesome name="users" size={58} color={colors.light.onPrimary} />
      </View>
      <Text style={styles.title}>TalkWise</Text>
      <Text style={styles.subtitle}>Your AI Parenting Coach</Text>
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.light.onPrimary} size="large" />
        <Text style={styles.loadingText}>Warming up...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  iconCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.xxl,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    ...shadows.overlay,
  },
  title: {
    ...typeScale.h1,
    color: colors.light.onPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScale.subheading,
    color: COLORS.onPrimary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  loadingText: {
    ...typeScale.bodySmall,
    color: COLORS.onPrimary,
  },
});

export default SplashScreen;
