// App Configuration

export const APP_CONFIG = {
  name: 'ParentAI',
  version: '1.0.0',
  disclaimer:
    'This app provides guidance and insights, not professional or medical diagnosis. Always consult qualified professionals for specific concerns about your child.',

  // Recording settings
  recording: {
    maxSessionDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    chunkDurationMs: 10 * 60 * 1000, // 10-minute chunks
    sampleRate: 16000,
    loudVoiceThreshold: 0.75, // 0-1 scale
    coachingCooldownMs: 60 * 1000, // 1 minute between alerts
  },

  // Analysis settings
  analysis: {
    toneCategories: [
      { key: 'calm', label: 'Calm', color: '#4CAF50', emoji: '😌' },
      { key: 'supportive', label: 'Supportive', color: '#2196F3', emoji: '🤗' },
      { key: 'neutral', label: 'Neutral', color: '#9E9E9E', emoji: '😐' },
      { key: 'frustrated', label: 'Frustrated', color: '#FF9800', emoji: '😤' },
      { key: 'angry', label: 'Angry', color: '#F44336', emoji: '😠' },
    ] as const,
    interactionTypes: ['discipline', 'support', 'conflict', 'teaching', 'play'] as const,
  },

  // Age groups for child profiles
  ageGroups: [
    { min: 0, max: 2, label: 'Infant', description: 'Focus on tone and presence' },
    { min: 3, max: 5, label: 'Toddler', description: 'Patience and gentle redirection' },
    { min: 6, max: 8, label: 'Early School', description: 'Explanation and encouragement' },
    { min: 9, max: 12, label: 'Pre-teen', description: 'Respect and autonomy' },
    { min: 13, max: 17, label: 'Teenager', description: 'Active listening and validation' },
  ] as const,
};
