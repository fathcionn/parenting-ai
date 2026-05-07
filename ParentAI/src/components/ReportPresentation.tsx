import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getScoreColor } from '../utils/reportUtils';
import { COLORS } from '../theme/colors';

export type ReportSafetyFlag = {
  safe?: boolean;
  severity?: string;
  detected?: string[];
  recommendation?: string;
} | null;

export function getScoreLabel(score: number) {
  if (score >= 90) return 'Outstanding! \u{1F31F}';
  if (score >= 80) return 'Excellent! \u{1F389}';
  if (score >= 70) return 'Great Work! \u{1F44D}';
  if (score >= 50) return 'Good Progress \u{1F4C8}';
  return 'Keep Practicing \u{1F4AA}';
}

export function SafetyBanner({ safetyFlag }: { safetyFlag?: ReportSafetyFlag }) {
  const severity = safetyFlag?.severity || 'none';
  const isUnsafe = safetyFlag && safetyFlag.safe !== true && severity !== 'none';

  if (isUnsafe && ['moderate', 'severe'].includes(severity)) {
    return (
      <View style={[styles.banner, styles.redBanner]}>
        <Text style={styles.redBannerText}>
          {'\u26A0\uFE0F'} Communication Alert - please review this session
        </Text>
      </View>
    );
  }

  if (isUnsafe && severity === 'mild') {
    return (
      <View style={[styles.banner, styles.yellowBanner]}>
        <Text style={styles.yellowBannerText}>
          {'\u{1F49B}'} Tip: Some communication patterns worth noting
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.greenBanner]}>
      <Text style={styles.greenBannerText}>{'\u2705'} Status: Healthy Communication</Text>
    </View>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const size = 164;
  const strokeWidth = 12;
  const ringRadius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
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
          r={ringRadius}
          stroke={COLORS.surfaceContainer}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
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
    <View style={[styles.card, styles.summaryCard]}>
      <Text style={styles.cardTitle}>{'\u{1F4CB}'} Session Summary</Text>
      <Text style={styles.paragraph}>{summary || 'Session completed. Review your coaching feedback below.'}</Text>
    </View>
  );
}

export function StrengthsCard({ strengths }: { strengths: string[] }) {
  return (
    <View style={[styles.card, styles.greenCard]}>
      <Text style={styles.cardTitle}>{'\u2705'} What Worked Well</Text>
      {(strengths.length ? strengths : ['Completed a coaching session']).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.row}>
          <Text style={[styles.dot, styles.greenDot]}>{'\u2022'}</Text>
          <Text style={styles.rowText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function ImprovementsCard({ improvements }: { improvements: string[] }) {
  return (
    <View style={[styles.card, styles.orangeCard]}>
      <Text style={styles.cardTitle}>{'\u{1F527}'} Areas to Improve</Text>
      {(improvements.length ? improvements : ['Keep practicing calm, clear communication.']).map((item, index) => (
        <View key={`${item}-${index}`} style={styles.row}>
          <Text style={[styles.dot, styles.orangeDot]}>{'\u2192'}</Text>
          <Text style={styles.rowText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function TipsCard({ tips }: { tips: string[] }) {
  return (
    <View style={[styles.card, styles.blueCard]}>
      <Text style={styles.cardTitle}>{'\u{1F4A1}'} Coaching Tips</Text>
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
    height: 164,
    justifyContent: 'center',
    width: 164,
  },
  ringCenter: {
    alignItems: 'center',
    position: 'absolute',
  },
  scoreNumber: {
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
  },
  scoreOutOf: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '500',
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  greenBanner: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  greenBannerText: {
    color: COLORS.successText,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  yellowBanner: {
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.warning,
  },
  yellowBannerText: {
    color: COLORS.warning,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  redBanner: {
    backgroundColor: COLORS.errorBg,
    borderColor: COLORS.error,
  },
  redBannerText: {
    color: COLORS.error,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  summaryCard: {
    borderTopColor: COLORS.primary,
    borderTopWidth: 3,
  },
  greenCard: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.successBorder,
  },
  orangeCard: {
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.warning,
  },
  blueCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.cardBorder,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  paragraph: {
    color: COLORS.textSecondary,
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 28,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginVertical: 5,
  },
  dot: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 22,
  },
  greenDot: {
    color: COLORS.successText,
  },
  orangeDot: {
    color: COLORS.primary,
  },
  rowText: {
    color: COLORS.textPrimary,
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  tipText: {
    color: COLORS.textPrimary,
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    marginVertical: 4,
  },
});
