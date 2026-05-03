import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

interface BadgeProps {
  text: string;
  type?: 'success' | 'warning' | 'error' | 'info' | 'calm' | 'aggressive' | 'supportive' | 'firm' | 'harsh';
}

export const Badge: React.FC<BadgeProps> = ({ text, type = 'info' }) => {
  const typeColors = {
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
    info: theme.colors.info,
    calm: theme.colors.calm,
    aggressive: theme.colors.aggressive,
    supportive: theme.colors.supportive,
    firm: theme.colors.neutral,
    harsh: theme.colors.error,
  };

  return (
    <View style={[styles.badge, { backgroundColor: typeColors[type] }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    marginVertical: theme.spacing.sm,
  },
  text: {
    fontSize: theme.typography.label.fontSize,
    fontWeight: '600',
    color: theme.colors.background,
  },
});
