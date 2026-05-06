import AsyncStorage from '@react-native-async-storage/async-storage';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

const slides = [
  {
    icon: 'users' as const,
    title: 'Welcome to TalkWise 👋',
    text: 'Your AI-powered parenting coach that helps you communicate better with your child',
  },
  {
    icon: 'microphone' as const,
    title: 'Record & Analyze 🎙️',
    text: 'Record your parenting moments and get instant AI feedback on your communication style',
  },
  {
    icon: 'line-chart' as const,
    title: 'Track Your Progress 📊',
    text: 'See your scores improve over time and discover your strengths as a parent',
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
      <View style={styles.iconCircle}>
        <FontAwesome name={slide.icon} size={48} color="#000" />
      </View>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.text}</Text>
      <View style={styles.dots}>
        {slides.map((item, dotIndex) => (
          <View key={item.title} style={[styles.dot, dotIndex === index && styles.dotActive]} />
        ))}
      </View>
      <TouchableOpacity style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 64,
    height: 128,
    justifyContent: 'center',
    marginBottom: 28,
    width: 128,
  },
  title: {
    color: '#000',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    maxWidth: 360,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 34,
  },
  dot: {
    backgroundColor: '#D8D8D8',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  dotActive: {
    backgroundColor: '#000',
    width: 28,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 14,
    marginTop: 36,
    maxWidth: 360,
    paddingVertical: 16,
    width: '100%',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
});
