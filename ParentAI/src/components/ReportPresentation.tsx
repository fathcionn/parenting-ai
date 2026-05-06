import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getScoreColor } from '../utils/reportUtils';

export type ReportSafetyFlag = {
  safe?: boolean;
  severity?: string;
  detected?: string[];
  recommendation?: string;
} | null;

export function getScoreLabel(score: number) {
  if (score >= 90) return 'Outstanding! 🌟';
  if (score >= 80) return 'Excellent! 🎉';
  if (score >= 70) return 'Great Work! 👍';
  if (score >= 50) return 'Good Progress 📈';
  return 'Keep Practicing 💪';
}

export function SafetyBanner({ safetyFlag }: { safetyFlag?: ReportSafetyFlag }) {
  const severity = safetyFlag?.severity || 'none';
  const isUnsafe = safetyFlag && safetyFlag.safe !== true && severity !== 'none';

  if (isUnsafe && ['moderate', 'severe'].includes(severity)) {
    return (
      <View style={[styles.banner, styles.redBanner]}>
        <Text style={styles.redBannerText}>⚠️ Communication Alert — please review this session</Text>
      </View>
    );
  }

  if (isUnsafe && severity === 'mild') {
    return (
      <View style={[styles.banner, styles.yellowBanner]}>
        <Text style={styles.yellowBannerText}>💛 Tip: Some communication patterns worth noting</Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.greenBanner]}>
      <Text style={styles.greenBannerText}>✅ Healthy communication detected</Text>
    </View>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const size = 184;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = getScoreColor(score);
  const dashOffset = useMemo(
    () => circumference * (1 - Math.max(0, Math.min(100, displayScore)) / 100),
    [circumference, displayScore]
  );

  useEffect(() => {
    setDisplayScore(0);
    const target = Math.max(0, Math.min(100, score));
    const interval = setInterval(() => {
      setDisplayScore((current) => {
        if (current >= target) {
          clearInterval(interval);
          return target;
        }
        return Math.min(target, current + 4);
      });
    }, 16);
    return () => clearInterval(interval);
  }, [score]);

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#ECECEC"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
        <Text style={styles.scoreOutOf}>/100</Text>
      </View>
    </View>
  );
}

export function SummaryCard({ summary }: { summary: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>📋 Session Summary</Text>
      <Text style={styles.paragraph}>
        {summary || 'Session completed. Review your coaching feedback below.'}
      </Text>
    </View>
  );
}

export function StrengthsCard({ strengths }: { strengths: string[] }) {
  return (
    <View style={[styles.card, styles.greenCard]}>
      <Text style={styles.cardTitle}>✅ What You Did Well</Text>
      {(strengths.length ? strengths : ['Completed a coaching session']).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.row}>
          <Text style={[styles.dot, styles.greenDot]}>•</Text>
          <Text style={styles.rowText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function ImprovementsCard({ improvements }: { improvements: string[] }) {
  return (
    <View style={[styles.card, styles.orangeCard]}>
      <Text style={styles.cardTitle}>🔧 Areas to Grow</Text>
      {(improvements.length ? improvements : ['Keep practicing calm, clear communication.']).map(
        (item, index) => (
          <View key={`${item}-${index}`} style={styles.row}>
            <Text style={[styles.dot, styles.orangeDot]}>•</Text>
            <Text style={styles.rowText}>{item}</Text>
          </View>
        )
      )}
    </View>
  );
}

export function TipsCard({ tips }: { tips: string[] }) {
  return (
    <View style={[styles.card, styles.blueCard]}>
      <Text style={styles.cardTitle}>💡 Personalized Tips for Next Time</Text>
      {(tips.length ? tips : ['Try a short, focused session next time.']).map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.tipText}>
          {index + 1}. {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ringWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 184,
    justifyContent: 'center',
    width: 184,
  },
  ringCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '900',
  },
  scoreOutOf: {
    color: '#888',
    fontSize: 13,
    fontWeight: '800',
  },
  banner: {
    borderRadius: 14,
    padding: 14,
  },
  greenBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  greenBannerText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '900',
  },
  yellowBanner: {
    backgroundColor: '#fefce8',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  yellowBannerText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '900',
  },
  redBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  redBannerText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#eeeeee',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  greenCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  orangeCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  blueCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  cardTitle: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 12,
  },
  paragraph: {
    color: '#222',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    marginVertical: 5,
  },
  dot: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  greenDot: {
    color: '#22c55e',
  },
  orangeDot: {
    color: '#f97316',
  },
  rowText: {
    color: '#111',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  tipText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginVertical: 4,
  },
});
