import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../../src/config/firebase-config';
import { COLORS } from '../../src/theme/colors';
import { getSessionTagLabel, reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';
import Svg, { Circle } from 'react-native-svg';
import { type ReportSafetyFlag } from '../../src/components/ReportPresentation';

type DetailReport = {
  id: string;
  date: Date;
  durationSeconds?: number;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tips: string[];
  childName?: string | null;
  tag?: string | null;
  safetyFlag?: ReportSafetyFlag;
};

const asArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

function localeForLanguage(language?: string) {
  if (language?.startsWith('ar')) return 'ar';
  if (language?.startsWith('tr')) return 'tr-TR';
  return 'en-US';
}

function formatDetailDate(date: Date, locale: string) {
  return date.toLocaleString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatChipDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFeedbackTitle(score: number, t: (key: string) => string) {
  if (score >= 90) return t('report_feedback_outstanding');
  if (score >= 80) return t('report_feedback_excellent');
  if (score >= 70) return t('report_feedback_great');
  if (score >= 50) return t('report_feedback_progress');
  return t('report_feedback_practice');
}

function ReportScoreRing({ score, label }: { score: number; label: string }) {
  const size = 192;
  const strokeWidth = 16;
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
          stroke={COLORS.surfaceContainerHigh}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.primary}
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
        <Text style={styles.scoreRingValue}>{clampedScore}</Text>
        <Text style={styles.scoreRingLabel}>{label}</Text>
      </View>
    </View>
  );
}

function formatDuration(seconds?: number) {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function ReportDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = localeForLanguage(i18n.language);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<DetailReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    const user = auth.currentUser;
    if (!user || !id) {
      setLoading(false);
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid, 'reports', id));
      if (!snapshot.exists()) {
        setReport(null);
        return;
      }
      const data = snapshot.data();
      setReport({
        id: snapshot.id,
        date: toReportDate(data.date || data.createdAt),
        durationSeconds: Number(data.durationSeconds || 0),
        score: reportScoreFromData(data),
        summary: String(data.summary || data.analysis?.impact_analysis || ''),
        strengths: asArray(data.strengths || data.analysis?.positive_notes),
        improvements: asArray(data.improvements || data.analysis?.detected_issues),
        tips: asArray(data.tips || data.suggestions || data.analysis?.suggestions),
        childName: data.childName || null,
        tag: data.tag || 'general',
        safetyFlag: data.safetyFlag || null,
      });
    } catch (error) {
      console.error('Failed to load report detail:', error);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const deleteReport = () => {
    const user = auth.currentUser;
    if (!user || !report) return;

    Alert.alert(t('history_delete_report_title'), t('history_delete_report_message'), [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('common_delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'users', user.uid, 'reports', report.id));
          router.back();
        },
      },
    ]);
  };

  const shareReport = async () => {
    if (!report) return;
    await Share.share({
      message:
        t('report_share_title') +
        '\n\n' +
        t('report_score') +
        ': ' +
        report.score +
        '/100\n\n' +
        t('report_strengths') +
        ':\n' +
        report.strengths.map((item) => '- ' + item).join('\n') +
        '\n\n' +
        t('report_growth_area') +
        ':\n' +
        report.improvements.map((item) => '- ' + item).join('\n') +
        '\n\n' +
        t('report_coach_tips') +
        ':\n' +
        report.tips.map((item) => '- ' + item).join('\n') +
        '\n\n' +
        t('report_generated_by'),
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>{t('report_loading')}</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyTitle}>{t('report_not_found')}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t('common_back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tagLabel = getSessionTagLabel(report.tag, t);
  const duration = formatDuration(report.durationSeconds);
  const recordedText = duration
    ? t('report_recorded_on_duration', { date: formatDetailDate(report.date, locale), duration })
    : t('report_recorded_on', { date: formatDetailDate(report.date, locale) });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('report_session_title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.chips}>
        <View style={[styles.metaChip, styles.dateChip]}>
          <MaterialIcons name="calendar-today" size={14} color={COLORS.textSecondary} />
          <Text style={styles.dateChipText}>{formatChipDate(report.date, locale)}</Text>
        </View>
        <View style={[styles.metaChip, styles.childChip]}>
          <MaterialIcons name="child-care" size={15} color="#07006C" />
          <Text style={styles.childChipText}>{report.childName || t('history_default_child')}</Text>
        </View>
        <View style={[styles.metaChip, styles.tagChip]}>
          <MaterialIcons name="bedtime" size={15} color="#5516BE" />
          <Text style={styles.tagChipText}>{tagLabel}</Text>
        </View>
      </View>

      <View style={styles.scoreHero}>
          <ReportScoreRing score={report.score} label={t('report_score')} />
        <Text style={styles.feedbackTitle}>{getFeedbackTitle(report.score, t)}</Text>
        <Text style={styles.feedbackText}>
          {report.summary || t('report_default_feedback')}
        </Text>
      </View>

      <View style={styles.bentoGrid}>
        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.summaryIcon]}>
              <MaterialIcons name="notes" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>{t('report_summary')}</Text>
          </View>
          <Text style={styles.cardBody}>{report.summary || t('report_default_summary')}</Text>
        </View>

        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.strengthIcon]}>
              <MaterialIcons name="thumb-up" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>{t('report_strengths')}</Text>
          </View>
          <View style={styles.listWrap}>
            {(report.strengths.length ? report.strengths : [t('report_default_strength')]).map((item, itemIndex) => (
              <View key={item + '-' + itemIndex} style={styles.listItem}>
                <MaterialIcons name="check-circle" size={18} color="#86EFAC" />
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.growthIcon]}>
              <MaterialIcons name="trending-up" size={22} color="#BA1A1A" />
            </View>
            <Text style={styles.cardTitle}>{t('report_growth_area')}</Text>
          </View>
          <Text style={styles.cardBody}>
            {report.improvements.length ? report.improvements[0] : t('report_default_growth')}
          </Text>
        </View>

        <View style={[styles.reportCard, styles.tipsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.tipsIcon]}>
              <MaterialIcons name="lightbulb" size={22} color="#8455EF" />
            </View>
            <Text style={styles.cardTitle}>{t('report_coach_tips')}</Text>
          </View>
          <Text style={styles.cardBody}>
            {report.tips.length ? report.tips[0] : t('report_default_tip')}
          </Text>
          <TouchableOpacity
            style={styles.scriptButton}
            activeOpacity={0.85}
            onPress={() => Alert.alert(t('report_script_alternative'), t('report_script_soon'))}
          >
            <Text style={styles.scriptButtonText}>{t('report_script_alternative')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.safetyBanner}>
        <MaterialIcons name="verified-user" size={26} color={COLORS.textFaint} />
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyTitle}>{t('report_safety_passed')}</Text>
          <Text style={styles.safetyText}>{t('report_safety_text')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t('report_analyzed_by')}</Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={[styles.footerButton, styles.shareButton]} onPress={shareReport} activeOpacity={0.85}>
            <MaterialIcons name="share" size={18} color={COLORS.primary} />
            <Text style={styles.shareText}>{t('common_share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerButton, styles.deleteButton]} onPress={deleteReport} activeOpacity={0.85}>
            <MaterialIcons name="delete" size={18} color="#BA1A1A" />
            <Text style={styles.deleteText}>{t('common_delete')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.recordedText}>
          {recordedText}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48, gap: 18 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.primary, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dateChip: { backgroundColor: COLORS.surfaceContainer },
  childChip: { backgroundColor: COLORS.surfaceContainerHigh },
  tagChip: { backgroundColor: COLORS.surfaceContainer },
  dateChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800' },
  childChipText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '900' },
  tagChipText: { color: '#C4B5FD', fontSize: 12, fontWeight: '900' },
  scoreHero: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  scoreRingWrap: { width: 192, height: 192, alignItems: 'center', justifyContent: 'center' },
  scoreRingCenter: { position: 'absolute', alignItems: 'center' },
  scoreRingValue: { color: COLORS.primary, fontSize: 48, lineHeight: 54, fontWeight: '900' },
  scoreRingLabel: { color: COLORS.textFaint, fontSize: 13, fontWeight: '800' },
  feedbackTitle: { color: COLORS.primary, fontSize: 20, fontWeight: '900', marginTop: 14 },
  feedbackText: { maxWidth: 340, color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  bentoGrid: { gap: 16 },
  reportCard: { backgroundColor: COLORS.cardBg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 18, shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 4, ...Platform.select({ web: { boxShadow: '0px 16px 32px rgba(0, 0, 0, 0.24)' } as any }) },
  tipsCard: { borderLeftWidth: 6, borderLeftColor: '#67E8F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { backgroundColor: '#8B5CF6' },
  strengthIcon: { backgroundColor: '#276749' },
  growthIcon: { backgroundColor: '#3B1822' },
  tipsIcon: { backgroundColor: COLORS.surfaceContainerHigh },
  cardTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' },
  cardBody: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 23 },
  listWrap: { gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  listText: { flex: 1, color: COLORS.textSecondary, fontSize: 15, lineHeight: 22 },
  scriptButton: { alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: 999, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  scriptButtonText: { color: COLORS.onPrimary, fontSize: 14, fontWeight: '900' },
  safetyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: COLORS.surfaceContainer, borderRadius: 8, padding: 16, marginTop: 6 },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '900' },
  safetyText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 3 },
  footer: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 18, marginTop: 12 },
  footerText: { color: COLORS.textFaint, fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  footerButtons: { flexDirection: 'row', gap: 12 },
  footerButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, borderWidth: 1, backgroundColor: 'transparent' },
  shareButton: { borderColor: '#6D5591' },
  deleteButton: { borderColor: '#FDA4AF' },
  shareText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  deleteText: { color: '#FDA4AF', fontSize: 14, fontWeight: '900' },
  recordedText: { color: COLORS.textFaint, fontSize: 11, fontWeight: '700', lineHeight: 16, textAlign: 'center', marginTop: 14 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  emptyText: { color: COLORS.textFaint, fontSize: 14, fontWeight: '700' },
  secondaryButton: { borderColor: COLORS.primary, borderRadius: 999, borderWidth: 1, marginTop: 16, paddingHorizontal: 22, paddingVertical: 11 },
  secondaryText: { color: COLORS.primary, fontWeight: '900' },
});
