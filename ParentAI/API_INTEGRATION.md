# ParentAI API & Integration Guide

## 🔌 Audio Recording Flow

### AudioService Methods

#### `requestPermissions()`
Request microphone access from user.
```typescript
const hasPermission = await audioService.requestPermissions();
if (!hasPermission) {
  Alert.alert('Permission Denied', 'Microphone access required');
}
```

#### `startRecording()`
Start recording audio from microphone.
```typescript
try {
  await audioService.startRecording();
  // Recording now active
} catch (error) {
  console.error('Failed to start', error);
}
```

#### `stopRecording()`
Stop and save recording to device.
```typescript
const recording = await audioService.stopRecording();
if (recording) {
  console.log(`Recorded: ${recording.duration}s`);
  console.log(`URI: ${recording.uri}`);
}
```

#### `playAudio(uri)`
Play previously recorded audio.
```typescript
await audioService.playAudio(recording.uri);
```

#### `deleteRecording(uri)`
Remove audio file from device storage.
```typescript
await audioService.deleteRecording(recording.uri);
```

---

## 🤖 AI Analysis Flow

### WhisperService Methods

#### `transcribeAudio(audioUri)`
Convert audio file to text using OpenAI Whisper.

```typescript
const result = await whisperService.transcribeAudio(audioUri);
// Result: { text: "Hello child...", language: "en" }
```

**Behind the scenes:**
1. Fetch audio blob from file URI
2. Create multipart form with audio file
3. Send to OpenAI Whisper API
4. Parse response text
5. Return transcript

**API Request:**
```
POST https://api.openai.com/v1/audio/transcriptions
Content-Type: multipart/form-data
Authorization: Bearer sk-...

file: [audio.mp3]
model: whisper-1
language: en
```

#### `analyzeText(payload)`
Analyze transcript for tone, negative phrases, and suggestions.

```typescript
const analysis = await whisperService.analyzeText({
  text: "You always mess up, just go to your room!"
});

// Result:
{
  tone: "aggressive",
  confidence: 0.92,
  negativePhrases: ["always mess up", "go to your room"],
  suggestions: [
    "Try rephrasing: 'I need you to think about your choices'",
    "Use 'I' statements to express feelings"
  ],
  psychologicalImpact: "...",
  emotionalIntensity: 0.85,
  mistakes: ["always mess up"]
}
```

**Analysis Pipeline:**
1. Detect negative phrases (heuristic)
2. Calculate emotional intensity
3. Call HuggingFace BART for zero-shot classification
4. Get tone label (calm, aggressive, supportive, neutral)
5. Generate suggestions based on tone
6. Analyze psychological impact

**Fallback (No API Key):**
If no HuggingFace key configured, uses heuristic analysis:
- Scores based on detected keywords
- Simple tone classification
- Basic suggestions

---

## 📡 Firestore Data Structure

### Users Collection
```
users/{uid}
├── displayName: string
├── email: string
├── photoURL?: string
├── parentingScore: number (0-100)
├── children: ChildProfile[]
├── isAnonymous: boolean
├── language: 'en' | 'ar' | 'tr'
├── settings: {
│   ├── backgroundRecording: boolean
│   ├── notificationsEnabled: boolean
│   └── dataSharingConsent: boolean
├── createdAt: Timestamp
└── updatedAt: Timestamp
```

### Sessions Collection
```
sessions/{sessionId}
├── userId: string (FK: users/{uid})
├── childId: string (FK: children[childId])
├── audioUri?: string
├── duration: number (seconds)
├── transcript: string
├── analysis: {
│   ├── tone: string
│   ├── confidence: number
│   ├── negativePhrases: string[]
│   ├── suggestions: string[]
│   ├── psychologicalImpact: string
│   ├── emotionalIntensity: number
│   └── mistakes: string[]
├── rawAnalysisData?: object
├── timestamp: Timestamp
└── metadata: {
    ├── source: 'live' | 'background' | 'manual'
    ├── processed: boolean
    └── version: string
}
```

### Reports Collection
```
reports/{reportId}
├── userId: string (FK: users/{uid})
├── date: Timestamp (daily report date)
├── period: 'daily' | 'weekly' | 'monthly'
├── stats: {
│   ├── totalSessions: number
│   ├── totalDuration: number
│   ├── positiveRatio: number (0-1)
│   ├── negativeRatio: number (0-1)
│   ├── avgTone: string
│   ├── avgEmotionalIntensity: number
│   └── toneDistribution: {
│       ├── calm: number
│       ├── aggressive: number
│       ├── supportive: number
│       └── neutral: number
├── insights: string[]
├── recommendations: string[]
├── generatedAt: Timestamp
└── metadata: object
```

### Leaderboard Collection
```
leaderboard/{userId}
├── uid: string
├── displayName: string
├── parentingScore: number
├── streak: number (days)
├── totalSessions: number
├── rank: number
├── visible: boolean
└── updatedAt: Timestamp
```

---

## 🔔 Push Notifications

### Setup (iOS & Android)
```typescript
// In app initialization
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### Sending Notifications

#### Immediate (Live Coaching)
```typescript
// When negative tone detected
Notifications.scheduleNotificationAsync({
  content: {
    title: "Coaching Alert",
    body: "Try to stay calm. This may affect your child.",
    data: { analysis_id: sessionId },
  },
  trigger: { seconds: 1 },
});
```

#### Scheduled (Daily Reports)
```typescript
// Send at 8 PM every day
Notifications.scheduleNotificationAsync({
  content: {
    title: "Daily Report Ready",
    body: "View your parenting insights for today",
    data: { report_id: reportId },
  },
  trigger: { hour: 20, minute: 0, repeats: true },
});
```

#### Weekly Insights
```typescript
// Send Sunday at 10 AM
Notifications.scheduleNotificationAsync({
  content: {
    title: "Weekly Insights",
    body: "You've improved 12% this week! 🎉",
    data: { report_id: weeklyReportId },
  },
  trigger: {
    weekday: 1, // Sunday
    hour: 10,
    minute: 0,
    repeats: true,
  },
});
```

---

## 🎮 Gamification System

### Scoring Algorithm

**Parenting Score Calculation:**
```
Base = 50

Tone Bonus:
- Calm sessions: +5 per session (max 25)
- Aggressive sessions: -10 (min -30)

Consistency Bonus:
- Daily streak: +1 per day (max 20)
- Weekly active: +5 (if 5+ sessions/week)

Improvement Bonus:
- Week-over-week improvement: +10 (max 30)
- Reaching milestones: +15

Result: Score 0-100 (rounded)
```

### Leaderboard Ranking
```typescript
// Optional, user can enable/disable
interface LeaderboardEntry {
  rank: number              // Position in rankings
  displayName: string       // Or "Anonymous"
  parentingScore: number    // Current score
  streak: number            // Consecutive days
  totalSessions: number     // Lifetime sessions
  visible: boolean          // User opted in
}
```

### Achievements (Future)
```typescript
interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  condition: () => boolean  // Unlocked when true
  points: number
  unlockedAt?: Date
}

// Examples:
// - First Session: 10 points
// - 7-Day Streak: 50 points
// - 100 Sessions: 100 points
// - 90+ Score Week: 50 points
// - Help Another User: 25 points
```

---

## 🌍 i18n Implementation

### Supported Languages

#### English (en)
```json
{
  "coaching": {
    "liveCoaching": "Live Coaching Mode",
    "recording": "Recording..."
  }
}
```

#### Arabic (ar) - RTL
```json
{
  "coaching": {
    "liveCoaching": "وضع التدريب المباشر",
    "recording": "جاري التسجيل..."
  }
}
```

#### Turkish (tr)
```json
{
  "coaching": {
    "liveCoaching": "Canlı Antrenman Modu",
    "recording": "Kaydediliyor..."
  }
}
```

### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <>
      <Text>{t('coaching.liveCoaching')}</Text>
      <Button onPress={() => i18n.changeLanguage('ar')} />
    </>
  );
}
```

### RTL Support
```typescript
import { I18nManager } from 'react-native';

// Auto-configure based on language
if (i18n.language === 'ar') {
  I18nManager.forceRTL(true);
} else {
  I18nManager.forceRTL(false);
}
```

---

## 🔐 Authentication Flows

### Email/Password Sign Up
```
1. User enters email & password in SignupScreen
2. validateForm() checks requirements
3. createUserWithEmailAndPassword(auth, email, password)
4. Firebase returns User object
5. Create Firestore doc in users/{uid}
6. setUser() updates auth store
7. Redirect to home
```

### Email/Password Sign In
```
1. User enters credentials in LoginScreen
2. validateForm() validates input
3. signInWithEmailAndPassword(auth, email, password)
4. Firebase returns User object
5. Fetch user profile from Firestore
6. setProfile() updates auth store
7. Redirect to home
```

### OAuth (Google/Apple - Future)
```
1. User taps "Sign in with Google"
2. openAuthSessionAsync() opens Google login
3. Firebase receives Google token
4. Create or fetch user
5. Same as email flow
```

### Sign Out
```
1. User taps logout in ProfileScreen
2. Alert confirmation dialog
3. signOut(auth)
4. localStorage cleared
5. logout() clears stores
6. Redirect to login
```

---

## 📱 Background Recording (Future Implementation)

### iOS Requirements
- Add to Info.plist:
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>ParentAI needs microphone access for coaching</string>
  <key>UIBackgroundModes</key>
  <array>
    <string>audio</string>
  </array>
  ```

### Android Requirements
- Add to AndroidManifest.xml:
  ```xml
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  ```

### Implementation Plan
```typescript
// Start background recording
audioService.startBackgroundRecording({
  maxDuration: 3600, // 1 hour
  pauseThreshold: 3000, // Stop after 3s silence
  autoAnalyze: true,
});

// Receive updates
audioService.on('recording-updated', (duration) => {
  console.log(`Recorded: ${duration}s`);
});

// Stop and analyze
const sessions = await audioService.stopBackgroundRecording();
// Returns array of AnalysisResult[]
```

---

## 🚀 Error Handling

### Standard Error Response
```typescript
interface AppError {
  code: string                // 'AUTH_FAILED', 'API_ERROR', etc
  message: string            // User-friendly message
  details?: string           // Technical details
  retry?: () => Promise<any> // Retry function
}
```

### Common Errors

| Code | Message | Action |
|------|---------|--------|
| `PERMISSION_DENIED` | Microphone access required | Request permission |
| `NETWORK_ERROR` | No internet connection | Retry with alert |
| `AUTH_FAILED` | Invalid credentials | Show login form |
| `QUOTA_EXCEEDED` | API quota reached | Queue and retry later |
| `INVALID_AUDIO` | Audio file corrupted | Re-record |

---

## 📊 Analytics Events

Recommended tracking:
```typescript
// Event logging examples
analytics.logEvent('session_recorded', {
  duration: 120,
  tone: 'calm',
  has_negative_phrases: false,
});

analytics.logEvent('leaderboard_viewed', {
  user_anonymous: false,
});

analytics.logEvent('language_changed', {
  from: 'en',
  to: 'ar',
});
```

---

**API Version**: 1.0  
**Last Updated**: May 2, 2026
