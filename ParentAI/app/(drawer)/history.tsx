import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { auth, db } from '../../src/config/firebase-config';
import { BorderRadius, Colors, Spacing, Typography } from '../../src/constants/theme';
import { SESSION_TAGS, getScoreColor, getSessionTag, reportScoreFromData, toReportDate } from '../../src/utils/reportUtils';

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

const formatDate = (date: Date) =>
  date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

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
      <FontAwesome name="trash-o" size={20} color="#FFF" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('history_title')}</Text>

      <View style={styles.searchBar}>
        <FontAwesome name="search" size={14} color={Colors.textMuted} />
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          placeholder={t('history_search')}
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilter}>
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
          <Text style={styles.emptyIcon}>???</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Start your first coaching session to see your history here</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(drawer)/coaching' as any)}>
            <Text style={styles.emptyButtonText}>Start First Session</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredHistory.map((record) => {
          const tag = getSessionTag(record.tag);
          const scoreColor = getScoreColor(record.score);
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
                  <Text style={styles.dateText}>{formatDate(record.date)}</Text>
                  {record.childName ? <Text style={styles.childText}>{record.childName}</Text> : null}
                  <View style={styles.badgeRow}>
                    <View style={styles.toneBadge}>
                      <Text style={styles.toneBadgeText}>{record.tone}</Text>
                    </View>
                    {record.safetyFlag ? (
                      <View style={styles.warningBadge}>
                        <Text style={styles.warningBadgeText}>?? {record.safetyFlag.severity}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.tagBadge, { backgroundColor: tag.color }]}>
                      <Text style={styles.tagBadgeText}>
                        {tag.icon} {tag.label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.scoreArea}>
                  <Text style={[styles.score, { color: scoreColor }]}>{record.score}</Text>
                  <Text style={styles.scoreLabel}>{t('profile_parenting_score')}</Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    deleteRecord(record);
                  }}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="trash-o" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
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
    backgroundColor: Colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    ...Typography.bodySmall,
    color: Colors.text,
    flex: 1,
    paddingVertical: 12,
  },
  tagFilter: {
    marginBottom: Spacing.lg,
  },
  filterPill: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterPillActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  filterText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  cardMain: {
    flex: 1,
    gap: 8,
  },
  dateText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '700',
  },
  childText: {
    color: '#777',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toneBadge: {
    backgroundColor: Colors.primaryFaded,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toneBadgeText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tagBadge: {
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  warningBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  warningBadgeText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  tagBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreArea: {
    alignItems: 'center',
    minWidth: 52,
  },
  score: {
    fontSize: 26,
    fontWeight: '800',
  },
  scoreLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  deleteButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 36,
  },
  swipeDelete: {
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: 18,
  },
  swipeDeleteText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  skeletonCard: {
    backgroundColor: '#E5E5E5',
    borderRadius: BorderRadius.lg,
    height: 88,
    marginBottom: Spacing.sm,
    padding: 16,
  },
  skeletonLineWide: {
    backgroundColor: '#D2D2D2',
    borderRadius: 8,
    height: 16,
    marginBottom: 12,
    width: '55%',
  },
  skeletonLine: {
    backgroundColor: '#D2D2D2',
    borderRadius: 8,
    height: 12,
    width: '35%',
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
