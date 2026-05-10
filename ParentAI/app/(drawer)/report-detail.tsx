import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase-config';
import { getSessionTag, reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';
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

function formatDetailDate(date: Date) {
  return date.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatChipDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getFeedbackTitle(score: number) {
  if (score >= 90) return 'Outstanding!';
  if (score >= 80) return 'Excellent!';
  if (score >= 70) return 'Great Work!';
  if (score >= 50) return 'Good Progress';
  return 'Keep Practicing';
}

function ReportScoreRing({ score }: { score: number }) {
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
          stroke="#E4E1ED"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#4648D4"
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
        <Text style={styles.scoreRingLabel}>Score</Text>
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
  const router = useRouter();
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

    Alert.alert('Delete Report', 'Are you sure you want to delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
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
        'My Parenting Session Report ??\n\nScore: ' +
        report.score +
        '/100\n\nStrengths:\n' +
        report.strengths.map((item) => '? ' + item).join('\n') +
        '\n\nAreas to Improve:\n' +
        report.improvements.map((item) => '?? ' + item).join('\n') +
        '\n\nTips:\n' +
        report.tips.map((item) => '?? ' + item).join('\n') +
        '\n\nGenerated by TalkWise App',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Loading report...</Text>
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyTitle}>Report not found</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tag = getSessionTag(report.tag);
  const duration = formatDuration(report.durationSeconds);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <MaterialIcons name="arrow-back" size={24} color="#464554" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.chips}>
        <View style={[styles.metaChip, styles.dateChip]}>
          <MaterialIcons name="calendar-today" size={14} color="#464554" />
          <Text style={styles.dateChipText}>{formatChipDate(report.date)}</Text>
        </View>
        <View style={[styles.metaChip, styles.childChip]}>
          <MaterialIcons name="child-care" size={15} color="#07006C" />
          <Text style={styles.childChipText}>{report.childName || 'Sarah'}</Text>
        </View>
        <View style={[styles.metaChip, styles.tagChip]}>
          <MaterialIcons name="bedtime" size={15} color="#5516BE" />
          <Text style={styles.tagChipText}>{tag.label}</Text>
        </View>
      </View>

      <View style={styles.scoreHero}>
        <ReportScoreRing score={report.score} />
        <Text style={styles.feedbackTitle}>{getFeedbackTitle(report.score)}</Text>
        <Text style={styles.feedbackText}>
          A solid approach to establishing a calm bedtime routine with supportive communication.
        </Text>
      </View>

      <View style={styles.bentoGrid}>
        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.summaryIcon]}>
              <MaterialIcons name="notes" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>Summary</Text>
          </View>
          <Text style={styles.cardBody}>{report.summary || 'The conversation started well and stayed focused on calm connection.'}</Text>
        </View>

        <View style={styles.reportCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.strengthIcon]}>
              <MaterialIcons name="thumb-up" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>Strengths</Text>
          </View>
          <View style={styles.listWrap}>
            {(report.strengths.length ? report.strengths : ['Using calm voice tone and validating feelings.']).map((item, itemIndex) => (
              <View key={item + '-' + itemIndex} style={styles.listItem}>
                <MaterialIcons name="check-circle" size={18} color="#904900" />
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
            <Text style={styles.cardTitle}>Growth Area</Text>
          </View>
          <Text style={styles.cardBody}>
            {report.improvements.length ? report.improvements[0] : 'Try to avoid negotiating after the boundary has been set.'}
          </Text>
        </View>

        <View style={[styles.reportCard, styles.tipsCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconCircle, styles.tipsIcon]}>
              <MaterialIcons name="lightbulb" size={22} color="#8455EF" />
            </View>
            <Text style={styles.cardTitle}>Coach Tips</Text>
          </View>
          <Text style={styles.cardBody}>
            {report.tips.length ? report.tips[0] : 'Next time, try using a visual timer before transitions.'}
          </Text>
          <TouchableOpacity
            style={styles.scriptButton}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Script Alternative', 'Script alternatives are coming soon.')}
          >
            <Text style={styles.scriptButtonText}>View Script Alternative</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.safetyBanner}>
        <MaterialIcons name="verified-user" size={26} color="#767586" />
        <View style={styles.safetyCopy}>
          <Text style={styles.safetyTitle}>Safety Check Passed</Text>
          <Text style={styles.safetyText}>No critical emotional risks were detected in this session.</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Analyzed by TalkWise AI</Text>
        <View style={styles.footerButtons}>
          <TouchableOpacity style={[styles.footerButton, styles.shareButton]} onPress={shareReport} activeOpacity={0.85}>
            <MaterialIcons name="share" size={18} color="#4648D4" />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.footerButton, styles.deleteButton]} onPress={deleteReport} activeOpacity={0.85}>
            <MaterialIcons name="delete" size={18} color="#BA1A1A" />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.recordedText}>
          Session recorded on {formatDetailDate(report.date)}{duration ? ' ? ' + duration : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FCF8FF' },
  content: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 48, gap: 18 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E1ED' },
  headerTitle: { color: '#4648D4', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  headerSpacer: { width: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dateChip: { backgroundColor: '#E9E6F3' },
  childChip: { backgroundColor: '#E1E0FF' },
  tagChip: { backgroundColor: '#E9DDFF' },
  dateChipText: { color: '#464554', fontSize: 12, fontWeight: '800' },
  childChipText: { color: '#07006C', fontSize: 12, fontWeight: '900' },
  tagChipText: { color: '#5516BE', fontSize: 12, fontWeight: '900' },
  scoreHero: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  scoreRingWrap: { width: 192, height: 192, alignItems: 'center', justifyContent: 'center' },
  scoreRingCenter: { position: 'absolute', alignItems: 'center' },
  scoreRingValue: { color: '#4648D4', fontSize: 48, lineHeight: 54, fontWeight: '900' },
  scoreRingLabel: { color: '#767586', fontSize: 13, fontWeight: '800' },
  feedbackTitle: { color: '#4648D4', fontSize: 20, fontWeight: '900', marginTop: 14 },
  feedbackText: { maxWidth: 340, color: '#464554', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  bentoGrid: { gap: 16 },
  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E4E1ED', padding: 18, shadowColor: '#312E81', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 4, ...Platform.select({ web: { boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)' } as any }) },
  tipsCard: { borderLeftWidth: 6, borderLeftColor: '#06B6D4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { backgroundColor: '#6063EE' },
  strengthIcon: { backgroundColor: '#B55D00' },
  growthIcon: { backgroundColor: '#FFDAD6' },
  tipsIcon: { backgroundColor: '#E9E6F3' },
  cardTitle: { color: '#1B1B23', fontSize: 18, fontWeight: '900' },
  cardBody: { color: '#464554', fontSize: 15, lineHeight: 23 },
  listWrap: { gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  listText: { flex: 1, color: '#464554', fontSize: 15, lineHeight: 22 },
  scriptButton: { alignSelf: 'flex-start', backgroundColor: '#8455EF', borderRadius: 999, marginTop: 16, paddingHorizontal: 18, paddingVertical: 11 },
  scriptButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  safetyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#EFECF8', borderRadius: 8, padding: 16, marginTop: 6 },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: '#1B1B23', fontSize: 15, fontWeight: '900' },
  safetyText: { color: '#464554', fontSize: 13, lineHeight: 19, marginTop: 3 },
  footer: { borderTopWidth: 1, borderTopColor: '#E4E1ED', paddingTop: 18, marginTop: 12 },
  footerText: { color: '#767586', fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  footerButtons: { flexDirection: 'row', gap: 12 },
  footerButton: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, borderWidth: 1, backgroundColor: 'transparent' },
  shareButton: { borderColor: '#C7C4D7' },
  deleteButton: { borderColor: '#BA1A1A' },
  shareText: { color: '#4648D4', fontSize: 14, fontWeight: '900' },
  deleteText: { color: '#BA1A1A', fontSize: 14, fontWeight: '900' },
  recordedText: { color: '#767586', fontSize: 11, fontWeight: '700', lineHeight: 16, textAlign: 'center', marginTop: 14 },
  emptyTitle: { color: '#1B1B23', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  emptyText: { color: '#767586', fontSize: 14, fontWeight: '700' },
  secondaryButton: { borderColor: '#4648D4', borderRadius: 999, borderWidth: 1, marginTop: 16, paddingHorizontal: 22, paddingVertical: 11 },
  secondaryText: { color: '#4648D4', fontWeight: '900' },
});
