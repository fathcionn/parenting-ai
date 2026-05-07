import React, { useMemo } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSessionTag } from '../../src/utils/reportUtils';
import {
  getScoreLabel,
  SafetyBanner,
  ScoreRing,
  SummaryCard,
  type ReportSafetyFlag,
} from '../../src/components/ReportPresentation';
import { COLORS } from '../../src/theme/colors';

function parseArray(value?: string | string[]) {
  try {
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseSafety(value?: string | string[]): ReportSafetyFlag {
  try {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SessionResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    score?: string;
    summary?: string;
    strengths?: string;
    improvements?: string;
    tips?: string;
    safetyFlag?: string;
    reportId?: string;
    childName?: string;
    sessionTag?: string;
    durationSeconds?: string;
  }>();

  const score = Math.max(0, Math.min(100, Math.round(Number(params.score || 0))));
  const summary = String(params.summary || '');
  const strengths = useMemo(() => parseArray(params.strengths), [params.strengths]);
  const improvements = useMemo(() => parseArray(params.improvements), [params.improvements]);
  const tips = useMemo(() => parseArray(params.tips), [params.tips]);
  const safetyFlag = useMemo(() => parseSafety(params.safetyFlag), [params.safetyFlag]);
  const tag = getSessionTag(params.sessionTag || 'general');
  const subtitle = [params.childName, tag.label].filter(Boolean).join(' • ');
  const durationSeconds = Number(params.durationSeconds || 0);
  const durationLabel = durationSeconds ? `${Math.max(1, Math.round(durationSeconds / 60))}m` : '';

  const shareReport = async () => {
    await Share.share({
      message: `My TalkWise Session Report\n\nScore: ${score}/100\n${summary}\n\nStrengths:\n${strengths
        .map((item) => '✅ ' + item)
        .join('\n')}\n\nAreas to Grow:\n${improvements
        .map((item) => '🔧 ' + item)
        .join('\n')}\n\nTips:\n${tips.map((item) => '💡 ' + item).join('\n')}`,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.labelCaps}>SESSION OVERVIEW</Text>
        <Text style={styles.title}>Session Complete {'\u2713'}</Text>
        <Text style={styles.subtitle}>
          {[durationLabel ? `Duration: ${durationLabel}` : '', subtitle ? `Context: ${subtitle}` : 'TalkWise coaching session']
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardLabel}>COACHING SCORE</Text>
        <ScoreRing score={score} />
        <Text style={styles.scoreLabel}>{getScoreLabel(score)}</Text>
        <Text style={styles.scoreSubtitle}>Based on this session</Text>
      </View>

      <SafetyBanner safetyFlag={safetyFlag} />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(drawer)' as any)}>
          <Text style={styles.primaryText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={shareReport}>
          <Text style={styles.secondaryText}>Share</Text>
        </TouchableOpacity>
      </View>

      <SummaryCard summary={summary} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What Worked Well</Text>
        {(strengths.length ? strengths : ['Completed a coaching session']).map((item, index) => (
          <View key={`${item}-${index}`} style={styles.tipRow}>
            <FontAwesome name="check-circle" size={18} color={COLORS.primary} />
            <Text style={styles.tipText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Areas to Improve</Text>
        {(improvements.length ? improvements : ['Keep practicing calm, clear communication.']).map((item, index) => (
          <View key={`${item}-${index}`} style={styles.moduleRow}>
            <View style={styles.tipRowText}>
              <FontAwesome name="arrow-right" size={16} color={COLORS.primary} />
              <Text style={styles.tipText}>{item}</Text>
            </View>
            <TouchableOpacity
              style={styles.moduleButton}
              onPress={() => Alert.alert('Module Library', 'Coaching modules will open here when they are available.')}
            >
              <Text style={styles.moduleButtonText}>View Module</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coaching Tips</Text>
        {(tips.length ? tips : ['Try a short, focused session next time.']).map((item, index) => (
          <Text key={`${item}-${index}`} style={styles.tipText}>
            {index + 1}. {item}
          </Text>
        ))}
      </View>

      <TouchableOpacity style={styles.newSessionButton} onPress={() => router.push('/(drawer)/coaching' as any)}>
        <Text style={styles.newSessionText}>Start New Session</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 42,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  header: {
    borderBottomColor: COLORS.cardBorder,
    borderBottomWidth: 1,
    paddingBottom: 24,
  },
  labelCaps: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 54,
    marginTop: 10,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 8,
  },
  scoreCard: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 24,
    borderWidth: 1,
    padding: 32,
  },
  scoreCardLabel: {
    alignSelf: 'flex-start',
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  scoreLabel: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
  },
  scoreSubtitle: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 9999,
    flex: 1,
    paddingVertical: 14,
  },
  primaryText: {
    color: COLORS.onPrimary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.primary,
    borderRadius: 9999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryText: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tipRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  tipRowText: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  moduleRow: {
    alignItems: 'flex-start',
    gap: 12,
  },
  tipText: {
    color: COLORS.textSecondary,
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  moduleButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.primary,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  moduleButtonText: {
    color: COLORS.primary,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  newSessionButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  newSessionText: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
