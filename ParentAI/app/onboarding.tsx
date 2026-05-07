import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, colors } from '../src/theme/colors';
import { radius, shadows, spacing } from '../src/theme/spacing';
import { typeScale } from '../src/theme/typography';

const slides = [
  {
    icon: 'users' as const,
    title: 'Welcome to TalkWise 👋',
    text: 'Your AI-powered parenting coach that helps you communicate better with your child',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOSY1qsj_kjyHnOlEOGLVZ32VFpEVxhNHdyFGnKjXjn_uSTkDsGc4IZVBGvVkEhv9O945bNJupOAbtxStWL0_LjxVH52r_eQTZoQEKVfZF0Z2AnO10q_1nUS1uOPTwufLWiSSwNEqBun-2NPEBN6VTvXodET9_icGnrTrMJNfN2oYyyUwpTb52GX2VeGQfJo6p5WQJ5mLIjTheGdX12suP18TSTJdIPfD9isHEPTcsR17Xe8VBOn0Ai1vCURMyaKdtxjtdon2vxfs',
  },
  {
    icon: 'microphone' as const,
    title: 'Record & Analyze 🎙️',
    text: 'Record your parenting moments and get instant AI feedback on your communication style',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM-ph8THFQxslu7L-lxlIA3LP0goyzhr5WrflSrKwhE4SxiOW8jLf7unJbKIbqfsCHOAPgqmTHj7tXJ5O_db-frAoJ3imOwwXOAz2PpMWsFTxSsVUk3pnEhP3iBZmHFJflqb0olL3TORcp8bRNVk5Hslq3gi7pdB8SThq90NA81qyzTMKL5gBIwbDxOwza966lgGYYfqU1xdR-n_C3hCZ-HNbu1DKp0PFts1zDRvQdKhtZJWiGPammmOMpfWbHhbGA7XiuNO_Tn-0',
  },
  {
    icon: 'line-chart' as const,
    title: 'Track Your Progress 📊',
    text: 'See your scores improve over time and discover your strengths as a parent',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9kh_wg_3UkFD3Y76Z9r_PiBZ7j6gwA3p7UwwFmIs5dxa9zDdKUZS7QZpGSz8NytgYtCI8Xth1fqHz1e998qFSe9U34_t9IJZM1dIdNtvRDJCeMK0Ui65GKWgiu_Xww5mwW-ptmXhY7PghD3HRBhP7Lim4Ys53bgfu5zKr_Nq8jqIrDrSnny3tJdKCLUpwu4-u2xAHkxQwqibVDQhw09rqAiyxH6YcSvqpJ1giapbxEOofBEuGvpPgT4nfq10wGLJLCZLUu8drIec',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  const next = async () => {
    if (index < slides.length - 1) {
      setIndex(index + 1);
      return;
    }

    await AsyncStorage.setItem('onboardingComplete', 'true');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      {index === 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={next}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <View style={styles.heroCard}>
        <Image source={{ uri: slide.image }} style={styles.heroImage} resizeMode="cover" />
        {index === 1 && (
          <View style={styles.floatingBadge}>
            <FontAwesome name={slide.icon} size={20} color={colors.light.onPrimary} />
          </View>
        )}
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.text}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((item, dotIndex) => (
            <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity activeOpacity={0.88} onPress={next} style={styles.buttonWrap}>
          <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.button}>
            <Text style={styles.buttonText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
            <FontAwesome name="arrow-right" size={15} color={colors.light.onPrimary} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.light.card,
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.md,
  },
  skipText: {
    ...typeScale.button,
    color: colors.light.primary,
  },
  heroCard: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: colors.light.surface,
    borderColor: colors.light.border,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 420,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    ...shadows.card,
  },
  heroImage: {
    height: '100%',
    width: '100%',
  },
  floatingBadge: {
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    borderRadius: radius.full,
    height: 48,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 48,
    ...shadows.card,
  },
  textBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 360,
  },
  title: {
    ...typeScale.h1,
    color: colors.light.text,
    textAlign: 'center',
  },
  body: {
    ...typeScale.body,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xl,
    maxWidth: 420,
    paddingBottom: spacing.md,
    width: '100%',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    backgroundColor: colors.light.border,
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.light.primary,
    width: 32,
  },
  buttonWrap: {
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.full,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  buttonText: {
    ...typeScale.button,
    color: colors.light.onPrimary,
  },
});
