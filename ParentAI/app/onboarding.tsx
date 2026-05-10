import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const slides = [
  {
    icon: 'groups',
    title: 'Welcome to TalkWise',
    emoji: '👋',
    text: 'Your AI-powered parenting coach that helps you communicate better with your child',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBOSY1qsj_kjyHnOlEOGLVZ32VFpEVxhNHdyFGnKjXjn_uSTkDsGc4IZVBGvVkEhv9O945bNJupOAbtxStWL0_LjxVH52r_eQTZoQEKVfZF0Z2AnO10q_1nUS1uOPTwufLWiSSwNEqBun-2NPEBN6VTvXodET9_icGnrTrMJNfN2oYyyUwpTb52GX2VeGQfJo6p5WQJ5mLIjTheGdX12suP18TSTJdIPfD9isHEPTcsR17Xe8VBOn0Ai1vCURMyaKdtxjtdon2vxfs',
  },
  {
    icon: 'mic',
    title: 'Record & Analyze 🎙️',
    text: 'Record your parenting moments and get instant AI feedback on your communication style.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCM-ph8THFQxslu7L-lxlIA3LP0goyzhr5WrflSrKwhE4SxiOW8jLf7unJbKIbqfsCHOAPgqmTHj7tXJ5O_db-frAoJ3imOwwXOAz2PpMWsFTxSsVUk3pnEhP3iBZmHFJflqb0olL3TORcp8bRNVk5Hslq3gi7pdB8SThq90NA81qyzTMKL5gBIwbDxOwza966lgGYYfqU1xdR-n_C3hCZ-HNbu1DKp0PFts1zDRvQdKhtZJWiGPammmOMpfWbHhbGA7XiuNO_Tn-0',
  },
  {
    icon: 'show-chart',
    title: 'Track Your Progress 📊',
    text: 'See your scores improve over time and discover your strengths as a parent',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD9kh_wg_3UkFD3Y76Z9r_PiBZ7j6gwA3p7UwwFmIs5dxa9zDdKUZS7QZpGSz8NytgYtCI8Xth1fqHz1e998qFSe9U34_t9IJZM1dIdNtvRDJCeMK0Ui65GKWgiu_Xww5mwW-ptmXhY7PghD3HRBhP7Lim4Ys53bgfu5zKr_Nq8jqIrDrSnny3tJdKCLUpwu4-u2xAHkxQwqibVDQhw09rqAiyxH6YcSvqpJ1giapbxEOofBEuGvpPgT4nfq10wGLJLCZLUu8drIec',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isFirstSlide = index === 0;
  const isFinalSlide = index === slides.length - 1;

  const next = async () => {
    if (index < slides.length - 1) {
      setIndex(index + 1);
      return;
    }

    await AsyncStorage.setItem('onboardingComplete', 'true');
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topNav}>
          {!isFirstSlide && !isFinalSlide && (
            <TouchableOpacity style={styles.skipButton} onPress={next} activeOpacity={0.8}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[
            styles.mainContent,
            isFirstSlide && styles.firstMainContent,
            isFinalSlide && styles.finalMainContent,
          ]}
        >
          <View
            style={[
              isFirstSlide && styles.firstIllustrationBox,
              !isFirstSlide && !isFinalSlide && styles.illustrationWrap,
              isFinalSlide && styles.finalIllustrationBox,
            ]}
          >
            {!isFirstSlide && !isFinalSlide && <View style={styles.glowCircle} />}
            <View
              style={[
                isFirstSlide && styles.firstImageFrame,
                !isFirstSlide && !isFinalSlide && styles.imageCircle,
                isFinalSlide && styles.finalImageFrame,
              ]}
            >
              <Image
                source={{ uri: slide.image }}
                style={styles.heroImage}
                resizeMode={isFirstSlide || isFinalSlide ? 'contain' : 'cover'}
              />
            </View>
            {!isFirstSlide && !isFinalSlide && (
              <View style={styles.floatingBadge}>
                <MaterialIcons name="mic" size={24} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.textBlock}>
            <Text
              style={[
                styles.title,
                isFirstSlide && styles.firstTitle,
                isFinalSlide && styles.finalTitle,
              ]}
            >
              {slide.title}
            </Text>
            {isFirstSlide && <Text style={styles.waveEmoji}>{slide.emoji}</Text>}
            <Text style={[styles.subtitle, isFinalSlide && styles.finalSubtitle]}>{slide.text}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((item, dotIndex) => (
              <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.88} onPress={next} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isFinalSlide ? 'Get Started' : 'Next'}</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCF8FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FCF8FF',
    paddingHorizontal: 24,
  },
  topNav: {
    minHeight: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipButton: {
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  skipText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '800',
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 42,
  },
  firstMainContent: {
    gap: 34,
  },
  finalMainContent: {
    gap: 34,
  },
  firstIllustrationBox: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAEDDF',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#7C2D12',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 6,
    ...Platform.select({
      web: {
        boxShadow: '0px 20px 48px rgba(124, 45, 18, 0.10)',
      } as any,
    }),
  },
  firstImageFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  illustrationWrap: {
    width: 260,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  finalIllustrationBox: {
    width: '100%',
    maxWidth: 400,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2FE',
    borderColor: '#E4E1ED',
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 24px 62px rgba(49, 46, 129, 0.16)',
      } as any,
    }),
  },
  glowCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28,
    shadowRadius: 42,
    elevation: 10,
    ...Platform.select({
      web: {
        filter: 'blur(18px)',
        boxShadow: '0px 28px 70px rgba(139, 92, 246, 0.24)',
      } as any,
    }),
  },
  imageCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 6,
    borderColor: '#FFFFFF',
    shadowColor: '#312E81',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 22px 48px rgba(49, 46, 129, 0.18)',
      } as any,
    }),
  },
  finalImageFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingBadge: {
    position: 'absolute',
    top: 24,
    right: 26,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderWidth: 4,
    borderColor: '#FCF8FF',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 7,
    ...Platform.select({
      web: {
        boxShadow: '0px 14px 28px rgba(139, 92, 246, 0.32)',
      } as any,
    }),
  },
  textBlock: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
  },
  title: {
    color: '#1B1B23',
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  firstTitle: {
    marginBottom: 6,
  },
  finalTitle: {
    color: '#6366F1',
  },
  waveEmoji: {
    fontSize: 34,
    lineHeight: 42,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: '#464554',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  finalSubtitle: {
    lineHeight: 26,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 22,
    gap: 26,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DBD8E4',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 430,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 999,
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 7,
    ...Platform.select({
      web: {
        boxShadow: '0px 18px 36px rgba(99, 102, 241, 0.28)',
      } as any,
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
