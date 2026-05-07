import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTranslation } from 'react-i18next';
import { RecordingComponent } from '../../src/components/RecordingComponent';
import { useAppStore } from '../../src/stores/app-store';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';

export default function RecordScreen() {
  const { t } = useTranslation();
  const { children, selectedChildId } = useAppStore();
  const selectedChild = children.find((child) => child.id === selectedChildId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('coaching_title')}</Text>
          <Text style={styles.subtitle}>{t('coaching_subtitle')}</Text>
        </View>

        {selectedChild && (
          <View style={styles.childBadge}>
            <FontAwesome name="user" size={14} color={Colors.text} />
            <Text style={styles.childName}>{selectedChild.name}</Text>
          </View>
        )}
      </View>

      <RecordingComponent
        childId={selectedChildId}
        title={t('coaching_session_title')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  childBadge: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  childName: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
});
