import React, { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSessionTag } from '../../src/utils/reportUtils';
import {
  getScoreLabel,
  ImprovementsCard,
  SafetyBanner,
  ScoreRing,
  StrengthsCard,
  SummaryCard,
  TipsCard,
  type ReportSafetyFlag,
} from '../../src/components/ReportPresentation';

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
  }>();

  const score = Math.max(0, Math.min(100, Math.round(Number(params.score || 0))));
  const summary = String(params.summary || '');
  const strengths = useMemo(() => parseArray(params.strengths), [params.strengths]);
  const improvements = useMemo(() => parseArray(params.improvements), [params.improvements]);
  const tips = useMemo(() => parseArray(params.tips), [params.tips]);
  const safetyFlag = useMemo(() => parseSafety(params.safetyFlag), [params.safetyFlag]);
  const tag = getSessionTag(params.sessionTag || 'general');
  const subtitle = [params.childName, tag.label].filter(Boolean).join(' · ');

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome name="chevron-left" size={15} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Session Complete 🎉</Text>
          <Text style={styles.subtitle}>{subtitle || 'TalkWise coaching session'}</Text>
        </View>
      </View>

      <View style={styles.scoreSection}>
        <ScoreRing score={score} />
        <Text style={styles.scoreLabel}>{getScoreLabel(score)}</Text>
      </View>

      <SafetyBanner safetyFlag={safetyFlag} />
      <SummaryCard summary={summary} />
      <StrengthsCard strengths={strengths} />
      <ImprovementsCard improvements={improvements} />
      <TipsCard tips={tips} />

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(drawer)/history' as any)}>
        <Text style={styles.primaryText}>View Full History →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(drawer)/record' as any)}>
        <Text style={styles.secondaryText}>Start New Session</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareLink} onPress={shareReport}>
        <Text style={styles.shareText}>Share Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 42,
    paddingHorizontal: 22,
    paddingTop: 58,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#000',
    fontSize: 27,
    fontWeight: '900',
  },
  subtitle: {
    color: '#777',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  scoreLabel: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 15,
    paddingVertical: 16,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#000',
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 16,
  },
  secondaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
  },
  shareLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  shareText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
