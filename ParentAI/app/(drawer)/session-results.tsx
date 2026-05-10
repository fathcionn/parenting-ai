import React, { useMemo } from 'react';
import { Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSessionTag } from '../../src/utils/reportUtils';
import { type ReportSafetyFlag } from '../../src/components/ReportPresentation';
import Svg, { Circle } from 'react-native-svg';

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

function ResultsScoreRing({ score }: { score: number }) {
  const size = 192;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clampedScore / 100);

  return (
    <View style={styles.scoreRingWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E4E1ED"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#EAB308"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreRingCenter}>
        <Text style={styles.scoreValue}>{clampedScore}</Text>
        <Text style={styles.scoreLabel}>Great Work! 👍</Text>
      </View>
    </View>
  );
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
  const hasConcern =
    params.safetyFlag === 'true' ||
    (typeof safetyFlag === 'object' && safetyFlag !== null && (safetyFlag as any).safe === false);
  const tag = getSessionTag(params.sessionTag || 'general');
  const subtitle = [params.childName || 'Sarah', tag.label || 'Bedtime Routine'].filter(Boolean).join(' ? ');

  const shareReport = async () => {
    await Share.share({
      message:
        'My TalkWise Session Report\n\nScore: ' +
        score +
        '/100\n' +
        summary +
        '\n\nStrengths:\n' +
        strengths.map((item) => '? ' + item).join('\n') +
        '\n\nAreas to Grow:\n' +
        improvements.map((item) => '?? ' + item).join('\n') +
        '\n\nTips:\n' +
        tips.map((item) => '?? ' + item).join('\n'),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.replace('/(drawer)' as any)} activeOpacity={0.8}>
          <MaterialIcons name="close" size={24} color="#464554" />
        </TouchableOpacity>
        <Text style={styles.brandTitle}>TalkWise</Text>
        <View style={styles.profileCircle}>
          <MaterialIcons name="person" size={22} color="#464554" />
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Session Complete ??</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.scoreSection}>
          <ResultsScoreRing score={score} />
        </View>

        <View style={[styles.safetyBanner, hasConcern ? styles.safetyBannerConcern : styles.safetyBannerHealthy]}>
          <MaterialIcons
            name={hasConcern ? 'warning-amber' : 'check-circle'}
            size={22}
            color={hasConcern ? '#93000A' : '#16A34A'}
          />
          <Text style={[styles.safetyText, hasConcern ? styles.safetyTextConcern : styles.safetyTextHealthy]}>
            {hasConcern ? 'Concern Detected — Review tips below' : '✅ Healthy Communication Detected'}
          </Text>
        </View>

        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.summaryIcon]}>
              <MaterialIcons name="summarize" size={22} color="#0891B2" />
            </View>
            <Text style={styles.summaryTitle}>?? Session Summary</Text>
          </View>
          <Text style={styles.cardBody}>
            {summary || 'You successfully navigated the bedtime resistance with calm, supportive communication.'}
          </Text>
        </View>

        <View style={[styles.card, styles.strengthsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.strengthIcon]}>
              <MaterialIcons name="thumb-up" size={22} color="#15803D" />
            </View>
            <Text style={styles.strengthTitle}>? What You Did Well</Text>
          </View>
          {(strengths.length ? strengths : ['Completed a coaching session']).map((item, index) => (
            <View key={item + '-' + index} style={styles.listRow}>
              <MaterialIcons name="check" size={18} color="#22C55E" />
              <Text style={styles.strengthText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.growthCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.growthIcon]}>
              <MaterialIcons name="trending-up" size={22} color="#C2410C" />
            </View>
            <Text style={styles.growthTitle}>?? Areas to Grow</Text>
          </View>
          {(improvements.length ? improvements : ['Keep practicing calm, clear communication.']).map((item, index) => (
            <View key={item + '-' + index} style={styles.listRow}>
              <MaterialIcons name="arrow-right" size={18} color="#F97316" />
              <Text style={styles.growthText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.tipsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.tipsIcon]}>
              <MaterialIcons name="lightbulb" size={22} color="#1D4ED8" />
            </View>
            <Text style={styles.tipsTitle}>?? Tips for Next Time</Text>
          </View>
          {(tips.length ? tips : ['Set a 5-minute visual timer before transitions.', 'Use physical touch and calm proximity when appropriate.']).map((item, index) => (
            <Text key={item + '-' + index} style={styles.tipsText}>
              {index + 1}. {item}
            </Text>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shareReportButton}
            onPress={shareReport}
            activeOpacity={0.85}
          >
            <MaterialIcons name="share" size={20} color="#4648D4" />
            <Text style={styles.shareReportText}>Share Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/(drawer)/history' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.historyButtonText}>View Full History</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newSessionButton}
            onPress={() => router.push('/(drawer)/coaching' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.newSessionText}>Start New Session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FCF8FF' },
  topHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: '#FCF8FF' },
  headerIconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1ED' },
  brandTitle: { color: '#4648D4', fontSize: 24, fontWeight: '900' },
  profileCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4E1ED' },
  container: { flex: 1, backgroundColor: '#FCF8FF' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 16 },
  hero: { alignItems: 'center' },
  title: { color: '#1B1B23', fontSize: 32, lineHeight: 39, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { color: '#464554', fontSize: 16, lineHeight: 23, marginTop: 4, textAlign: 'center' },
  scoreSection: { alignItems: 'center', marginVertical: 16 },
  scoreRingWrap: { width: 192, height: 192, alignItems: 'center', justifyContent: 'center' },
  scoreRingCenter: { position: 'absolute', alignItems: 'center' },
  scoreValue: { color: '#EAB308', fontSize: 48, lineHeight: 55, fontWeight: '900' },
  scoreLabel: { color: '#464554', fontSize: 13, fontWeight: '800', marginTop: 2 },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 14 },
  safetyBannerHealthy: { backgroundColor: '#D6E8DC', borderColor: '#BBF7D0' },
  safetyBannerConcern: { backgroundColor: '#FFDAD6', borderColor: '#FCA5A5' },
  safetyText: { fontSize: 14, fontWeight: '800', flex: 1 },
  safetyTextHealthy: { color: '#166534' },
  safetyTextConcern: { color: '#93000A' },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, shadowColor: '#312E81', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 4, ...Platform.select({ web: { boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)' } as any }) },
  summaryCard: { backgroundColor: '#FFFFFF', borderColor: '#E4E1ED', borderLeftWidth: 6, borderLeftColor: '#22D3EE' },
  strengthsCard: { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' },
  growthCard: { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' },
  tipsCard: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { backgroundColor: '#CFFAFE' },
  strengthIcon: { backgroundColor: '#BBF7D0' },
  growthIcon: { backgroundColor: '#FED7AA' },
  tipsIcon: { backgroundColor: '#BFDBFE' },
  summaryTitle: { color: '#1B1B23', fontSize: 18, fontWeight: '900' },
  strengthTitle: { color: '#14532D', fontSize: 18, fontWeight: '900' },
  growthTitle: { color: '#7C2D12', fontSize: 18, fontWeight: '900' },
  tipsTitle: { color: '#1E3A8A', fontSize: 18, fontWeight: '900' },
  cardBody: { color: '#464554', fontSize: 15, lineHeight: 23 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 8 },
  strengthText: { flex: 1, color: '#166534', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  growthText: { flex: 1, color: '#9A3412', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  tipsText: { color: '#1E40AF', fontSize: 15, lineHeight: 23, fontWeight: '600', marginTop: 8 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E1ED', marginTop: 16, paddingTop: 22, gap: 12 },
  shareReportButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: '#C7C4D7', backgroundColor: 'transparent' },
  shareReportText: { color: '#4648D4', fontSize: 15, fontWeight: '900' },
  historyButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#8B5CF6', borderRadius: 999, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.24, shadowRadius: 24, elevation: 7, ...Platform.select({ web: { boxShadow: '0px 18px 36px rgba(139, 92, 246, 0.28)' } as any }) },
  historyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  newSessionButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#4648D4', backgroundColor: 'transparent' },
  newSessionText: { color: '#4648D4', fontSize: 16, fontWeight: '900' },
});
