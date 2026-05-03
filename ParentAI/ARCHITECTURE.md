# ParentAI v2 - Architecture & Technical Design

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                     │
│              (Expo + TypeScript + React 19)             │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐    ┌───▼────┐    ┌──▼──────┐
   │ Firebase│    │ Whisper│    │HuggingFace
   │  Auth   │    │  API   │    │Inference│
   └────┬────┘    └───┬────┘    └──┬──────┘
        │              │           │
   ┌────▼──────────────▼───────────▼─────┐
   │     Cloud Services & APIs           │
   │  (Authentication, AI, Storage)      │
   └─────────────────────────────────────┘
```

---

## 📱 App Layers

### 1. **Presentation Layer** (`app/` & `src/screens/`)
- Screen components (Home, Reports, Profile)
- Navigation with Expo Router
- Tab-based navigation system

### 2. **Component Layer** (`src/components/`)
- Reusable UI components (Button, TextField, Card, Badge)
- RecordingComponent (audio UI)
- AnalysisDisplay (results UI)
- Layout components (Container, Layout)

### 3. **State Management Layer** (`src/stores/`)
- **useAuthStore**: User authentication & profile
- **useCoachingStore**: Recording and analysis state
- Zustand for lightweight, scalable state

### 4. **Service Layer** (`src/services/`)
- **AudioService**: Microphone recording & playback
- **WhisperService**: Speech-to-text & AI analysis
- HTTP clients for API integration

### 5. **Configuration Layer** (`src/config/`)
- Firebase initialization
- i18n language setup
- Theme system

---

## 🔄 Data Flow

### Recording & Analysis Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Audio Recording │  (expo-av)
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│ Store Audio File     │  (expo-file-system)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Send to Whisper API  │  (transcribe audio)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Get Text Transcript  │  (from Whisper)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Send to HuggingFace  │  (analyze sentiment)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Get Analysis Result  │  (tone, suggestions)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Store in Firestore   │  (save session)
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Update UI & Store    │  (Zustand state)
└──────────────────────┘
```

---

## 🗄️ State Schema

### Auth Store
```typescript
{
  user: FirebaseUser | null              // Current authenticated user
  profile: UserProfile | null            // User's ParentAI profile
  loading: boolean                       // Auth loading state
  error: string | null                   // Auth error message
}

UserProfile {
  uid: string                            // Firebase UID
  email: string
  displayName: string
  parentingScore: number                 // 0-100
  children: ChildProfile[]
  isAnonymous: boolean                   // Leaderboard privacy
  language: 'en' | 'ar' | 'tr'
  createdAt: Date
}

ChildProfile {
  id: string
  name: string
  age: number
  createdAt: Date
}
```

### Coaching Store
```typescript
{
  isRecording: boolean
  isAnalyzing: boolean
  backgroundRecordingEnabled: boolean
  currentAnalysis: AnalysisResult | null
  analysisHistory: AnalysisResult[]
}

AnalysisResult {
  id: string
  text: string                           // Transcribed text
  tone: 'calm' | 'aggressive' | 'supportive' | 'neutral'
  confidence: number                     // 0-1
  negativePhrasesDetected: string[]
  suggestions: string[]                  // Alternatives
  psychologicalImpact: string            // Explanation
  emotionalIntensity: number             // 0-1
  mistakes: string[]
  timestamp: Date
  childId: string
}
```

---

## 🌐 API Integrations

### Firebase Authentication
- **Method**: REST + SDK
- **Endpoints**: 
  - Sign up: `POST /accounts:signUp`
  - Sign in: `POST /accounts:signInWithPassword`
  - Sign out: Local only
- **Features**: Email/Password, Google, Apple OAuth

### OpenAI Whisper API
- **Endpoint**: `https://api.openai.com/v1/audio/transcriptions`
- **Method**: `POST multipart/form-data`
- **Request**:
  ```
  file: audio.mp3 (required)
  model: whisper-1 (required)
  language: en (optional)
  ```
- **Response**: `{ text: string }`
- **Cost**: $0.006 per minute of audio

### HuggingFace Inference API
- **Endpoint**: `https://api-inference.huggingface.co/models/{model}`
- **Model**: `facebook/bart-large-mnli` (zero-shot classification)
- **Method**: `POST`
- **Request**:
  ```json
  {
    "inputs": "text to analyze",
    "parameters": {
      "candidate_labels": ["calm", "aggressive", "supportive", "neutral"]
    }
  }
  ```
- **Response**: 
  ```json
  {
    "sequence": "text",
    "labels": ["calm", "supportive", ...],
    "scores": [0.95, 0.03, ...]
  }
  ```
- **Cost**: Free tier available

### Firestore Database
- **Collections**:
  - `users/{uid}` - User profiles
  - `sessions/{sessionId}` - Recording sessions
  - `reports/{reportId}` - Daily/weekly reports
  - `leaderboard/{userId}` - Rankings

---

## 🔐 Security Model

### Authentication Flow
```
1. User credentials → Firebase
2. Firebase validates & issues JWT
3. JWT stored in AsyncStorage (secure on native)
4. JWT sent with each API request
5. Backend validates JWT
```

### Data Privacy
- Audio files: Auto-delete after processing
- Transcripts: Encrypted in Firestore
- API keys: Environment variables only
- User data: Optional leaderboard opt-in

### Firebase Security Rules
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId
    }
    match /sessions/{sessionId} {
      allow read: if request.auth != null
      allow create: if request.auth.uid == request.resource.data.userId
    }
  }
}
```

---

## 🎨 Component Hierarchy

```
App
├── RootLayout (i18n provider, auth init)
│   ├── AuthStack
│   │   ├── LoginScreen
│   │   └── SignupScreen
│   └── MainStack
│       └── TabsLayout
│           ├── HomeScreen
│           │   ├── RecordingComponent
│           │   └── AnalysisDisplay
│           ├── ReportsScreen
│           │   └── Charts
│           └── ProfileScreen
│               ├── UserInfo
│               ├── ChildManagement
│               └── Settings
```

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~54.0.33 | React Native framework |
| `expo-router` | ~6.0.23 | App navigation |
| `expo-av` | ^16.0.8 | Audio recording |
| `firebase` | ^10.0.0 | Backend services |
| `i18next` | ^23.0.0 | Internationalization |
| `react-i18next` | ^13.0.0 | i18n React bindings |
| `zustand` | ^5.0.12 | State management |
| `axios` | ^1.6.0 | HTTP client |

---

## 🔄 Lifecycle & Hooks

### App Initialization
```
1. RootLayout mounts
2. OnAuthStateChanged listener attached
3. User restored from Firebase
4. i18n initialized
5. Zustand stores ready
6. Screen rendered
```

### Recording Lifecycle
```
1. User taps "Record"
2. Request mic permissions
3. audioService.startRecording()
4. User speaks
5. User taps "Stop"
6. audioService.stopRecording() → AudioRecording
7. Send audio URI to Whisper API
8. Receive transcript text
9. Send text to analysis service
10. Render AnalysisDisplay
11. Save to Firestore session
12. Update coaching store
```

---

## ⚡ Performance Optimizations

1. **Code Splitting**: Route-based with Expo Router
2. **State Memoization**: useCallback in components
3. **Audio Processing**: Offload to background threads
4. **API Caching**: Local analysis cache for duplicates
5. **Image Optimization**: SVG for icons
6. **Bundle Size**: Tree-shaking enabled

---

## 🚀 Deployment Strategy

### Development
- Local Expo dev server
- Hot reload for fast iteration

### Staging
- EAS Build (Expo)
- Internal testing group

### Production
- EAS Build for iOS & Android
- App Store & Play Store
- Firebase for backend

---

## 📊 Analytics & Monitoring

Planned integrations:
- Firebase Analytics (user behavior)
- Sentry (error tracking)
- Firebase Crashlytics (crash reports)
- Custom logging (audio processing metrics)

---

**Architecture Version**: 2.0  
**Last Updated**: May 2, 2026
