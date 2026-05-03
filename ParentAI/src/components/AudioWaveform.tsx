import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { theme } from '../styles/theme';

interface AudioWaveformProps {
  amplitude: number;
  isRecording: boolean;
  isFading?: boolean;
  barCount?: number;
  height?: number;
  dark?: boolean;
}

function amplitudeFromMetering(metering?: number) {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return 0;
  const normalized = (metering + 60) / 60;
  return Math.max(0, Math.min(1, normalized));
}

export function normalizeMetering(metering?: number) {
  return amplitudeFromMetering(metering);
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  amplitude,
  isRecording,
  isFading = false,
  barCount = 36,
  height = 88,
  dark = false,
}) => {
  const bars = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.08))
  ).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const idlePulse = useRef(new Animated.Value(0)).current;
  const tick = useRef(0);

  const center = useMemo(() => (barCount - 1) / 2, [barCount]);

  useEffect(() => {
    if (!isRecording && !isFading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(idlePulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(idlePulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [idlePulse, isFading, isRecording]);

  useEffect(() => {
    if (isFading) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isFading, opacity]);

  useEffect(() => {
    if (!isRecording) {
      bars.forEach((bar, index) => {
        Animated.timing(bar, {
          toValue: 0.08 + (index % 2) * 0.02,
          duration: 220,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    tick.current += 1;
    bars.forEach((bar, index) => {
      const distanceFromCenter = Math.abs(index - center) / Math.max(center, 1);
      const centerBoost = 1 - distanceFromCenter * 0.55;
      const phase = Math.sin(tick.current * 0.45 + index * 0.55) * 0.16;
      const target = Math.max(0.08, Math.min(1, amplitude * centerBoost + phase + 0.08));
      Animated.timing(bar, {
        toValue: target,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    });
  }, [amplitude, bars, center, isRecording]);

  const idleOpacity = idlePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  const activeColor = dark ? '#FFFFFF' : '#000000';
  const idleColor = dark ? 'rgba(255,255,255,0.42)' : '#BDBDBD';

  return (
    <Animated.View style={[styles.container, { height, opacity }]}>
      <View style={styles.barRow}>
        {bars.map((bar, index) => {
          const animatedHeight = bar.interpolate({
            inputRange: [0, 1],
            outputRange: [3, height],
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                {
                  height: animatedHeight,
                  backgroundColor: isRecording ? activeColor : idleColor,
                  opacity: isRecording ? 1 : idleOpacity,
                },
              ]}
            />
          );
        })}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    width: '100%',
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    minHeight: 20,
  },
  bar: {
    borderRadius: 2,
    width: 4,
    backgroundColor: theme.colors.primary,
  },
});
