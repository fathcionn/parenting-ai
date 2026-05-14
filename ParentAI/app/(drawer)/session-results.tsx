import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, SafeAreaView, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSessionTagLabel } from '../../src/utils/reportUtils';
import { type ReportSafetyFlag } from '../../src/components/ReportPresentation';
import Svg, { Circle } from 'react-native-svg';
import { useCoachingStore } from '../../src/stores/coaching-store';
import { COLORS } from '../../src/theme/colors';
import { radius, shadows } from '../../src/theme/spacing';

function parseSafety(value?: string | string[]): ReportSafetyFlag {
  try {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ResultsScoreRing({ score, label }: { score: number; label: string }) {
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
          stroke={COLORS.ringTrack}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.warning}
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
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function SessionResultsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentAnalysis } = useCoachingStore();
  const params = useLocalSearchParams<{
    score?: string;
    safetyFlag?: string;
    reportId?: string;
    childName?: string;
    sessionTag?: string;
    durationSeconds?: string;
  }>();

  const score = Math.max(0, Math.min(100, Math.round(Number(currentAnalysis?.parentingScore ?? params.score ?? 0))));
  const summary = currentAnalysis?.summary || currentAnalysis?.analysis?.impact_analysis || '';
  const strengths = currentAnalysis?.strengths || currentAnalysis?.analysis?.positive_notes || [];
  const improvements = currentAnalysis?.improvements || currentAnalysis?.analysis?.detected_issues || [];
  const tips = currentAnalysis?.tips || currentAnalysis?.analysis?.suggestions || [];
  const developmentalImpact =
    currentAnalysis?.analysis?.impact_analysis ||
    t('results_default_impact');
  const transcript = currentAnalysis?.transcript || '';
  const safetyFlag = parseSafety(params.safetyFlag);
  const hasConcern =
    params.safetyFlag === 'true' ||
    (typeof safetyFlag === 'object' && safetyFlag !== null && (safetyFlag as any).safe === false);
  const tagLabel = getSessionTagLabel(params.sessionTag || 'general', t);
  const subtitle = [params.childName || t('history_default_child'), tagLabel].filter(Boolean).join(' - ');

  const shareReport = async () => {
    await Share.share({
      message:
        t('results_share_title') + '\n\n' + t('results_score') + ': ' +
        score +
        '/100\n' +
        summary +
        '\n\n' + t('results_strengths_plain') + ':\n' +
        strengths.map((item) => '- ' + item).join('\n') +
        '\n\n' + t('results_areas_to_grow') + ':\n' +
        improvements.map((item) => '- ' + item).join('\n') +
        '\n\n' + t('results_tips_plain') + ':\n' +
        tips.map((item) => '- ' + item).join('\n'),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.replace('/(drawer)' as any)} activeOpacity={0.8}>
          <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.brandTitle}>TalkWise</Text>
        <View style={styles.profileCircle}>
          <MaterialIcons name="person" size={22} color={COLORS.textSecondary} />
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>{t('results_title')}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.scoreSection}>
          <ResultsScoreRing score={score} label={t('results_great_work')} />
        </View>

        <View style={[styles.card, styles.summaryCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.summaryIcon]}>
              <MaterialIcons name="summarize" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.summaryTitle}>{t('results_summary')}</Text>
          </View>
          <Text style={styles.cardBody}>
            {summary || t('results_default_summary')}
          </Text>
        </View>

        <View style={[styles.card, styles.strengthsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.strengthIcon]}>
              <MaterialIcons name="thumb-up" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.strengthTitle}>{t('results_strengths')}</Text>
          </View>
          {(strengths.length ? strengths : [t('results_default_strength')]).map((item, index) => (
            <View key={item + '-' + index} style={styles.listRow}>
              <MaterialIcons name="check" size={18} color={COLORS.success} />
              <Text style={styles.strengthText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.growthCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.growthIcon]}>
              <MaterialIcons name="trending-up" size={22} color={COLORS.warning} />
            </View>
            <Text style={styles.growthTitle}>{t('results_growth')}</Text>
          </View>
          {(improvements.length ? improvements : [t('results_default_growth')]).map((item, index) => (
            <View key={item + '-' + index} style={styles.listRow}>
              <MaterialIcons name="arrow-right" size={18} color={COLORS.warning} />
              <Text style={styles.growthText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.tipsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.tipsIcon]}>
              <MaterialIcons name="lightbulb" size={22} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.tipsTitle}>{t('results_tips')}</Text>
          </View>
          {(tips.length ? tips : [t('results_default_tip_1'), t('results_default_tip_2')]).map((item, index) => (
            <Text key={item + '-' + index} style={styles.tipsText}>
              {index + 1}. {item}
            </Text>
          ))}
        </View>

        <View style={[styles.card, styles.impactCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.impactIcon]}>
              <MaterialIcons name="auto-graph" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.impactTitle}>{t('results_impact')}</Text>
          </View>
          <Text style={styles.cardBody}>{developmentalImpact}</Text>
        </View>

        <View style={[styles.card, styles.transcriptCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, styles.transcriptIcon]}>
              <MaterialIcons name="mic" size={22} color={COLORS.accent} />
            </View>
            <Text style={styles.transcriptTitle}>{t('results_transcript')}</Text>
          </View>
          <Text style={styles.transcriptText}>
            {transcript || t('results_default_transcript')}
          </Text>
        </View>

        <View style={[styles.safetyBanner, hasConcern ? styles.safetyBannerConcern : styles.safetyBannerHealthy]}>
          <MaterialIcons
            name={hasConcern ? 'warning-amber' : 'check-circle'}
            size={22}
            color={hasConcern ? COLORS.error : COLORS.success}
          />
          <Text style={[styles.safetyText, hasConcern ? styles.safetyTextConcern : styles.safetyTextHealthy]}>
            {hasConcern ? t('results_concern') : t('results_healthy')}
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shareReportButton}
            onPress={shareReport}
            activeOpacity={0.85}
          >
            <MaterialIcons name="share" size={20} color={COLORS.primary} />
            <Text style={styles.shareReportText}>{t('results_share')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push('/(drawer)/history' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.historyButtonText}>{t('results_history')}</Text>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.onPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newSessionButton}
            onPress={() => router.push('/(drawer)/coaching' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.newSessionText}>{t('results_new_session')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  topHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, backgroundColor: COLORS.background },
  headerIconButton: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border },
  brandTitle: { color: COLORS.primary, fontSize: 24, fontWeight: '900' },
  profileCircle: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceVariant },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 16 },
  hero: { alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 32, lineHeight: 39, fontWeight: '900', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { color: COLORS.textSecondary, fontSize: 16, lineHeight: 23, marginTop: 4, textAlign: 'center' },
  scoreSection: { alignItems: 'center', marginVertical: 16 },
  scoreRingWrap: { width: 192, height: 192, alignItems: 'center', justifyContent: 'center' },
  scoreRingCenter: { position: 'absolute', alignItems: 'center' },
  scoreValue: { color: COLORS.warning, fontSize: 48, lineHeight: 55, fontWeight: '900' },
  scoreLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  safetyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: radius.md, padding: 14 },
  safetyBannerHealthy: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  safetyBannerConcern: { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBg },
  safetyText: { fontSize: 14, fontWeight: '800', flex: 1 },
  safetyTextHealthy: { color: COLORS.successText },
  safetyTextConcern: { color: COLORS.error },
  card: { borderRadius: radius.xl, padding: 20, shadowColor: COLORS.primaryDark, shadowOffset: shadows.card.shadowOffset, shadowOpacity: shadows.card.shadowOpacity, shadowRadius: shadows.card.shadowRadius, elevation: shadows.card.elevation, ...Platform.select({ web: { boxShadow: '0px 18px 42px rgba(76, 29, 149, 0.10)' } as any }) },
  summaryCard: { backgroundColor: COLORS.cardBg, borderColor: COLORS.border, borderLeftWidth: 6, borderLeftColor: COLORS.accent },
  strengthsCard: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  growthCard: { backgroundColor: COLORS.warningBg, borderColor: COLORS.border },
  tipsCard: { backgroundColor: COLORS.surfaceContainer, borderColor: COLORS.border },
  impactCard: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  transcriptCard: { backgroundColor: COLORS.cardBg, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { backgroundColor: COLORS.surfaceContainerHigh },
  strengthIcon: { backgroundColor: COLORS.successBorder },
  growthIcon: { backgroundColor: COLORS.warningBg },
  tipsIcon: { backgroundColor: COLORS.surfaceContainerHigh },
  impactIcon: { backgroundColor: COLORS.successBorder },
  transcriptIcon: { backgroundColor: COLORS.surfaceContainer },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' },
  strengthTitle: { color: COLORS.successText, fontSize: 18, fontWeight: '900' },
  growthTitle: { color: COLORS.warning, fontSize: 18, fontWeight: '900' },
  tipsTitle: { color: COLORS.primaryDark, fontSize: 18, fontWeight: '900' },
  impactTitle: { color: COLORS.successText, fontSize: 18, fontWeight: '900' },
  transcriptTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' },
  cardBody: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 23 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 8 },
  strengthText: { flex: 1, color: COLORS.successText, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  growthText: { flex: 1, color: COLORS.warning, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  tipsText: { color: COLORS.primaryDark, fontSize: 15, lineHeight: 23, fontWeight: '600', marginTop: 8 },
  transcriptText: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 23 },
  footer: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 16, paddingTop: 22, gap: 12 },
  shareReportButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.full, borderWidth: 1, borderColor: COLORS.outline, backgroundColor: 'transparent' },
  shareReportText: { color: COLORS.primary, fontSize: 15, fontWeight: '900' },
  historyButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: radius.full, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.24, shadowRadius: 24, elevation: 7, ...Platform.select({ web: { boxShadow: '0px 18px 36px rgba(91, 33, 182, 0.24)' } as any }) },
  historyButtonText: { color: COLORS.onPrimary, fontSize: 16, fontWeight: '900' },
  newSessionButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: 'transparent' },
  newSessionText: { color: COLORS.primary, fontSize: 16, fontWeight: '900' },
});
