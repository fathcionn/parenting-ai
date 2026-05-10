import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { auth, db } from '../../src/config/firebase-config';
import { SESSION_TAGS, getSessionTag, reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';
import Svg, { Circle } from 'react-native-svg';

type HistoryReport = {
  id: string;
  date: Date;
  score: number;
  summary: string;
  tone: string;
  childName?: string | null;
  tag?: string | null;
  transcript?: string;
  safetyFlag?: {
    severity: string;
    detected: string[];
    recommendation: string;
  } | null;
};

const formatDate = (date: Date) => {
  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
};

function ScoreCircle({ score }: { score: number }) {
  const size = 58;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clampedScore / 100);

  return (
    <View style={styles.scoreCircleWrap}>
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
          stroke="#6366F1"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.scoreCircleText}>{clampedScore}</Text>
    </View>
  );
}

const tagPalette: Record<string, { bg: string; text: string }> = {
  bedtime: { bg: '#E9DDFF', text: '#5516BE' },
  homework: { bg: '#C0C1FF', text: '#07006C' },
  tantrum: { bg: '#FFDCC5', text: '#703700' },
  screen_time: { bg: '#FFE2C6', text: '#703700' },
  mealtime: { bg: '#DCFCE7', text: '#166534' },
  general: { bg: '#E4E1ED', text: '#464554' },
};

function SkeletonCards() {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: false }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View>
      {[0, 1, 2].map((item) => (
        <Animated.View key={item} style={[styles.skeletonCard, { opacity: pulse }]}>
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLine} />
        </Animated.View>
      ))}
    </View>
  );
}

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryReport[]>([]);
  const [queryText, setQueryText] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, 'users', user.uid, 'reports'), orderBy('date', 'desc'))
      );
      const nextHistory = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          date: toReportDate(data.date || data.createdAt),
          score: reportScoreFromData(data),
          summary: String(data.summary || data.analysis?.impact_analysis || ''),
          tone: String(data.analysis?.tone || data.tone || 'calm'),
          childName: data.childName || null,
          tag: data.tag || 'general',
          transcript: String(data.transcript || ''),
          safetyFlag: data.safetyFlag || null,
        };
      });
      setHistory(nextHistory);
    } catch (error) {
      console.error('Failed to load history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const filteredHistory = useMemo(() => {
    const normalizedQuery = queryText.trim().toLowerCase();
    return history.filter((item) => {
      const tagMatches = selectedTag === 'all' || item.tag === selectedTag;
      if (!tagMatches) return false;
      if (!normalizedQuery) return true;
      return (
        item.tone.toLowerCase().includes(normalizedQuery) ||
        item.transcript?.toLowerCase().includes(normalizedQuery) ||
        item.childName?.toLowerCase().includes(normalizedQuery) ||
        formatDate(item.date).toLowerCase().includes(normalizedQuery)
      );
    });
  }, [history, queryText, selectedTag]);

  const deleteRecord = (record: HistoryReport) => {
    const user = auth.currentUser;
    if (!user) return;
    Alert.alert('Delete Report', 'Are you sure you want to delete this report?', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('common_delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'reports', record.id));
            await loadHistory();
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete report.');
          }
        },
      },
    ]);
  };

  const renderRightActions = (record: HistoryReport) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => deleteRecord(record)}>
      <MaterialIcons name="delete-outline" size={26} color="#FFF" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Session History</Text>
        <Text style={styles.subtitle}>Review past insights and track progress over time.</Text>
      </View>

      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color="#767586" />
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          placeholder={t('history_search')}
          placeholderTextColor="#767586"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagFilter}
        contentContainerStyle={styles.tagFilterContent}
      >
        <TouchableOpacity
          style={[styles.filterPill, selectedTag === 'all' && styles.filterPillActive]}
          onPress={() => setSelectedTag('all')}
        >
          <Text style={selectedTag === 'all' ? styles.filterTextActive : styles.filterText}>All</Text>
        </TouchableOpacity>
        {SESSION_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={[styles.filterPill, selectedTag === tag.id && styles.filterPillActive]}
            onPress={() => setSelectedTag(tag.id)}
          >
            <Text style={selectedTag === tag.id ? styles.filterTextActive : styles.filterText}>
              {tag.icon} {tag.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <SkeletonCards />
      ) : filteredHistory.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="history" size={58} color="#6366F1" />
          <Text style={styles.emptyTitle}>No sessions yet.</Text>
          <Text style={styles.emptyText}>Start your first coaching session to see your history here.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/coaching' as any)}>
            <Text style={styles.emptyButtonText}>Start First Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredHistory.map((record) => {
          const tag = getSessionTag(record.tag);
          const palette = tagPalette[String(record.tag || 'general')] || tagPalette.general;
          return (
            <Swipeable key={record.id} renderRightActions={() => renderRightActions(record)}>
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.75}
                onPress={() =>
                  router.push({
                    pathname: '/(drawer)/report-detail' as any,
                    params: { id: record.id },
                  })
                }
              >
                <View style={styles.cardMain}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.childText}>{record.childName || 'Leo'}</Text>
                    <View style={[styles.tagBadge, { backgroundColor: palette.bg }]}>
                      <Text style={[styles.tagBadgeText, { color: palette.text }]}>
                        {tag.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.dateText}>{formatDate(record.date)}</Text>

                  <Text style={styles.summaryText} numberOfLines={1}>
                    {record.summary || record.transcript || 'Successfully navigated this parenting moment.'}
                  </Text>

                  <View style={styles.badgeRow}>
                    {record.safetyFlag ? (
                      <View style={styles.warningBadge}>
                        <MaterialIcons name="warning-amber" size={13} color="#B91C1C" />
                        <Text style={styles.warningBadgeText}>{record.safetyFlag.severity}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.scoreArea}>
                  <ScoreCircle score={record.score} />
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCF8FF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#1B1B23',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: '#464554',
    fontSize: 16,
    lineHeight: 24,
  },
  searchBar: {
    minHeight: 50,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: '#1B1B23',
    fontSize: 15,
    paddingVertical: Platform.OS === 'web' ? 14 : 0,
    outlineStyle: 'none' as any,
  },
  tagFilter: {
    flexGrow: 0,
    marginBottom: 24,
  },
  tagFilterContent: {
    gap: 8,
    paddingRight: 24,
  },
  filterPill: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E4E1ED',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterText: {
    color: '#464554',
    fontSize: 13,
    fontWeight: '800',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1ED',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    padding: 16,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 16px 32px rgba(49, 46, 129, 0.10)',
      } as any,
    }),
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 5,
  },
  childText: {
    color: '#1B1B23',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  tagBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  dateText: {
    color: '#767586',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  summaryText: {
    color: '#464554',
    fontSize: 14,
    lineHeight: 20,
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  warningBadgeText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scoreArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
  },
  scoreCircleWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircleText: {
    position: 'absolute',
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '900',
  },
  swipeDelete: {
    alignItems: 'center',
    backgroundColor: '#BA1A1A',
    borderRadius: 16,
    justifyContent: 'center',
    marginBottom: 14,
    marginLeft: 8,
    paddingHorizontal: 20,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  skeletonCard: {
    backgroundColor: '#EDEAF7',
    borderRadius: 16,
    height: 100,
    marginBottom: 14,
    padding: 16,
  },
  skeletonLineWide: {
    backgroundColor: '#DBD8E4',
    borderRadius: 8,
    height: 18,
    marginBottom: 14,
    width: '55%',
  },
  skeletonLine: {
    backgroundColor: '#DBD8E4',
    borderRadius: 8,
    height: 13,
    width: '72%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#F5F2FE',
    borderColor: '#DBD8E4',
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    paddingHorizontal: 28,
    paddingVertical: 56,
  },
  emptyTitle: {
    color: '#1B1B23',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#464554',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
