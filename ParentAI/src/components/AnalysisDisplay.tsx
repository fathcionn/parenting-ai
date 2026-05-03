import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';
import { Card } from './Layout';
import { Badge } from './Badge';
import type { CoachingReport } from '../types/analysis';
import { useTranslation } from 'react-i18next';

interface AnalysisDisplayProps {
  analysis: CoachingReport | null;
  showTranscript?: boolean;
}

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({
  analysis,
  showTranscript = true,
}) => {
  const { t } = useTranslation();

  if (!analysis) {
    return null;
  }

  const { analysis: result } = analysis;

  return (
    <View style={styles.container}>
      <Card title={t('coaching_tone')}>
        <View style={styles.toneContainer}>
          <Badge text={result.tone} type={result.tone as any} />
          <Text style={styles.confidence}>{t('coaching_confidence')}: {result.confidence}%</Text>
        </View>
        <Text style={styles.metaText}>{t('coaching_style')}: {result.parenting_style}</Text>
      </Card>

      <Card title={t('coaching_intensity')}>
        <View style={styles.intensityBar}>
          <View
            style={[
              styles.intensityFill,
              { width: `${result.emotional_intensity}%` },
            ]}
          />
        </View>
        <Text style={styles.intensityLabel}>{result.emotional_intensity}%</Text>
      </Card>

      {result.detected_issues.length > 0 && (
        <Card title={t('coaching_issues')}>
          {result.detected_issues.map((issue, idx) => (
            <Text key={`${issue}-${idx}`} style={styles.listItem}>
              {issue}
            </Text>
          ))}
        </Card>
      )}

      <Card title={t('coaching_suggestions')}>
        {result.suggestions.length > 0 ? (
          result.suggestions.map((suggestion, idx) => (
            <Text key={`${suggestion}-${idx}`} style={styles.suggestion}>
              {idx + 1}. {suggestion}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>{t('coaching_ready')}</Text>
        )}
      </Card>

      <Card title={t('coaching_impact')}>
        <Text style={styles.impact}>{result.impact_analysis}</Text>
      </Card>

      {result.positive_notes.length > 0 && (
        <Card title={t('coaching_positive')} style={styles.positiveCard}>
          {result.positive_notes.map((note, idx) => (
            <Text key={`${note}-${idx}`} style={styles.positiveText}>
              {note}
            </Text>
          ))}
        </Card>
      )}

      {showTranscript && (
        <Card title={t('coaching_transcript')}>
          <Text style={styles.impact}>{analysis.transcript}</Text>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
  },
  toneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidence: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing.md,
    textTransform: 'capitalize',
  },
  listItem: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 24,
    marginVertical: theme.spacing.sm,
  },
  suggestion: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 24,
    marginVertical: theme.spacing.sm,
  },
  impact: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 24,
  },
  intensityBar: {
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    height: 10,
    overflow: 'hidden',
  },
  intensityFill: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    height: '100%',
  },
  intensityLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.label.fontSize,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
    textAlign: 'right',
  },
  positiveCard: {
    backgroundColor: '#ECFDF5',
  },
  positiveText: {
    color: '#047857',
    fontSize: theme.typography.body.fontSize,
    lineHeight: 24,
    marginVertical: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
  },
});
