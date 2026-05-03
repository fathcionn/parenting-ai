# ParentAI v2 - Setup & Installation Guide

## 📋 Prerequisites

- Node.js (v16+) and npm
- Expo CLI: `npm install -g expo-cli`
- Firebase project (create at [Firebase Console](https://console.firebase.google.com))
- OpenAI API key (for Whisper transcription)
- HuggingFace API key (for free AI analysis)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ParentAI
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# AI Services
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-key
EXPO_PUBLIC_HUGGINGFACE_API_KEY=hf_your_huggingface_key
```

### 3. Start Development Server

```bash
npm run start
```

Then:
- Press `w` to open in web
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan QR code with Expo Go app

---

## 🏗️ Project Structure

```
ParentAI/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   ├── login.tsx          # Login screen
│   └── signup.tsx         # Signup screen
├── src/
│   ├── components/        # Reusable UI components
│   ├── config/            # Firebase, i18n setup
│   ├── locales/           # Translations (en, ar, tr)
│   ├── screens/           # Full screen components
│   ├── services/
│   │   ├── ai/           # AI analysis service
│   │   └── audio/        # Audio recording service
│   ├── stores/           # Zustand state management
│   ├── styles/           # Theme config
│   └── utils/            # Helper functions
├── package.json
└── tsconfig.json
```

---

## 🎨 Features Implemented

### ✅ Completed
- **Authentication**: Email/password with Firebase
- **Multi-language**: English (en), Arabic (ar-RTL), Turkish (tr)
- **Black & White UI**: Minimalist design with consistent theme
- **Audio Recording**: Real microphone input with `expo-av`
- **AI Analysis**: Tone detection, negative phrase detection
- **Dashboard**: Parenting score, child profiles, quick stats
- **Reports**: Daily/weekly analytics, behavioral patterns
- **Profile Management**: User settings, child profiles, language selector
- **State Management**: Zustand stores for auth & coaching

### 🔄 In Progress / Next Steps

1. **Firebase Integration**
   - Set up Firestore database schema
   - Implement cloud functions for data processing
   - Add real-time syncing

2. **AI Improvements**
   - Integrate Whisper API for actual speech-to-text
   - Connect HuggingFace NLP models
   - Implement context-aware analysis

3. **Live Coaching Mode**
   - Real-time audio stream processing
   - Push notifications for negative tone detection
   - Session recording and playback

4. **Gamification**
   - Leaderboard system
   - Achievement badges
   - Weekly challenges

5. **Advanced Features**
   - Background recording (iOS 13+ compatibility)
   - Cloud storage for audio files
   - Export reports as PDF
   - Dark mode toggle

---

## 🔐 Firebase Setup

### Database Schema (Firestore)

```
users/
├── {uid}/
│   ├── displayName: string
│   ├── email: string
│   ├── parentingScore: number
│   ├── isAnonymous: boolean
│   ├── language: 'en' | 'ar' | 'tr'
│   ├── createdAt: timestamp
│   └── children/
│       ├── {childId}/
│       │   ├── name: string
│       │   ├── age: number
│       │   └── createdAt: timestamp

sessions/
├── {sessionId}/
│   ├── userId: string
│   ├── childId: string
│   ├── transcript: string
│   ├── analysis: object
│   ├── duration: number
│   └── timestamp: timestamp

reports/
├── {reportId}/
│   ├── userId: string
│   ├── date: timestamp
│   ├── stats: object
│   └── metadata: object
```

---

## 🔑 Key Services

### Audio Service (`src/services/audio/audio-service.ts`)

```typescript
audioService.startRecording()      // Start recording
audioService.stopRecording()       // Stop & return AudioRecording
audioService.playAudio(uri)        // Play recording
audioService.deleteRecording(uri)  // Clean up
```

### Whisper Service (`src/services/ai/whisper-service.ts`)

```typescript
whisperService.transcribeAudio(audioUri)  // Convert audio to text
whisperService.analyzeText(payload)       // Get AI analysis
```

### State Stores

```typescript
useAuthStore()      // User & profile state
useCoachingStore()  // Recording & analysis state
```

---

## 📱 Available Scripts

```bash
npm run start      # Start dev server
npm run android    # Open on Android device
npm run ios        # Open on iOS simulator
npm run web        # Open in web browser
npm install        # Install dependencies
```

---

## 🌐 Language Support

Supported languages in `src/locales/`:
- **English (en)** - Default
- **Arabic (ar)** - RTL layout
- **Turkish (tr)** - LTR layout

Change language via Profile screen or:
```typescript
i18n.changeLanguage('ar')
```

---

## 🛠️ Development Tips

1. **Hot Reload**: Changes auto-reload via Metro Bundler
2. **Debugging**: Press `j` in terminal to open debugger
3. **Logs**: Console.log output appears in terminal
4. **Error Handling**: Red box shows runtime errors
5. **Network**: Logs show API calls via axios

---

## 🔗 API Integration Points

### Speech-to-Text
- **Provider**: OpenAI Whisper API
- **Endpoint**: `https://api.openai.com/v1/audio/transcriptions`
- **Method**: multipart/form-data POST

### NLP Analysis
- **Provider**: HuggingFace Inference API
- **Model**: facebook/bart-large-mnli (zero-shot classification)
- **Fallback**: Heuristic-based analysis (no API key required)

### Authentication
- **Provider**: Firebase Auth
- **Methods**: Email/Password, Google, Apple (configured in Firebase Console)

---

## ⚠️ Important Notes

1. **API Keys**: Never commit `.env.local` - add to `.gitignore`
2. **Audio Permissions**: iOS requires Info.plist configuration
3. **Expo Go Limitations**: Some native features require development build
4. **Package Versions**: Using compatible versions with Expo 54
5. **RTL Support**: Arabic layout auto-configures with i18n

---

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
# Clear cache
expo start -c

# Or reset
rm -rf .expo node_modules package-lock.json
npm install
```

### Firebase Not Connecting
- Verify `.env.local` has correct keys
- Check Firebase console firewall rules
- Enable Firebase Auth providers in console

### Audio Permissions Denied
- iOS: Check Info.plist for NSMicrophoneUsageDescription
- Android: Check AndroidManifest.xml permissions

---

## 📚 Next Steps

1. Configure Firebase project with proper Firestore rules
2. Add Google & Apple OAuth credentials to Firebase
3. Set up OpenAI & HuggingFace API keys
4. Test audio recording on real device
5. Implement background recording (native module)
6. Deploy to TestFlight or Play Store

---

## 📖 Resources

- [Expo Documentation](https://docs.expo.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [HuggingFace Inference API](https://huggingface.co/docs/api-inference/index)
- [React Native Docs](https://reactnative.dev/docs/getting-started)

---

**Last Updated**: May 2, 2026  
**Version**: 2.0.0 - MVP Release
