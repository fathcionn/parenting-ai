import React from 'react';
import { View, Text, StyleSheet, ScrollView, I18nManager } from 'react-native';
import { theme } from '../styles/theme';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: any;
}

export const Card: React.FC<CardProps> = ({ title, children, style }) => {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
};

interface ContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: any;
  isRTL?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  scroll = false,
  style,
  isRTL = false,
}) => {
  if (isRTL) {
    I18nManager.forceRTL(true);
  }

  const content = (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );

  return scroll ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
      {content}
    </ScrollView>
  ) : (
    content
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    ...theme.shadows.md,
  },
  title: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
});
