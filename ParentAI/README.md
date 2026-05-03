# ParentAI v2 🧒💬

> **AI-Powered Parenting Assistant | Real-time Coaching | Multi-language | iOS & Android**

ParentAI v2 is a production-ready mobile application that provides real-time AI-powered analysis of parent-child interactions to help users become more effective, empathetic parents.

## ✨ Key Features

### 🎙️ Real Audio Recording
- Record live interactions with your children
- Automatic microphone transcription via OpenAI Whisper
- Optional background recording mode
- Audio auto-delete after analysis for privacy

### 🤖 AI-Powered Analysis
- **Tone Detection**: Calm, supportive, neutral, aggressive
- **Language Analysis**: Identifies potentially harmful phrases
- **Suggestions**: AI-generated constructive alternatives
- **Emotional Impact**: Explains psychological effects on children
- **Intensity Scoring**: Measures emotional intensity (0-1)

### 📊 Smart Reports & Analytics  
- **Daily Report**: Positive/negative ratio, tone breakdown, session count
- **Weekly Insights**: Trend analysis, behavioral patterns, improvement suggestions
- **Charts & Visualizations**: Progress tracking, score trends
- **Downloadable Reports**: Export as PDF

### ⚡ Live Coaching Mode
- Real-time audio analysis during interactions
- Instant feedback & suggestions
- Push notifications for negative tone detection
- Actionable coaching prompts

### 👨‍👩‍👧‍👦 Child Profile Management
- Add multiple child profiles
- Age-based analysis adaptation
- Track progress per child
- Behavioral pattern insights

### 🎮 Gamification System
- **Parenting Score** (0-100): Based on calm tone, positive language, consistency
- **Streak Tracking**: Daily usage streaks with bonuses
- **Optional Leaderboard**: Public or anonymous ranking
- **Achievements**: Badges for milestones (future)

### 🌍 Multi-Language Support
- **English** (English, LTR) ✅
- **Arabic** (العربية, RTL) ✅  
- **Turkish** (Türkçe, LTR) ✅
- Dynamic language switching

### 🏪 Modern UI/UX
- Minimalist black & white design
- Follows Apple Human Interface Guidelines
- Smooth animations & transitions
- Accessibility-focused (large text, high contrast)

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React Native 19.1 + TypeScript |
| **Framework** | Expo 54.0 + Expo Router 6.0 |
| **State Management** | Zustand 5.0 |
| **Internationalization** | i18next 23.0 + React-i18next 13.0 |
| **Backend** | Firebase (Auth, Firestore, Storage) |
| **Audio** | expo-av 16.0 |
| **Speech-to-Text** | OpenAI Whisper API |
| **NLP Analysis** | HuggingFace Inference API |
| **HTTP Client** | Axios 1.6 |

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- Expo CLI (`npx expo`)
- Firebase project (for backend features)

### Installation

```bash
# Navigate to the project
cd ParentAI

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Device
```bash
# Android
npx expo start --android

# iOS
npx expo start --ios

# Web (for development/testing)
npx expo start --web
```

### Firebase Setup (Optional - for full backend)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication, Firestore, Cloud Storage, and Cloud Functions
3. Copy your Firebase config to `src/services/firebase-config.ts`
4. Deploy Cloud Functions:
   ```bash
   cd functions
   npm install
   npm run deploy
   ```
5. Set OpenAI API key:
   ```bash
   firebase functions:config:set openai.key="sk-..."
   ```

## Project Structure

```
ParentAI/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Tab navigation
│   │   ├── index.tsx       # Dashboard/Home
│   │   ├── record.tsx      # Recording screen
│   │   ├── reports.tsx     # Reports & analytics
│   │   └── profile.tsx     # Settings & children
│   └── _layout.tsx         # Root layout
├── src/
│   ├── constants/          # Theme, config
│   ├── data/               # Mock data for demo
│   ├── services/           # Firebase, API services
│   ├── stores/             # Zustand state stores
│   └── types/              # TypeScript definitions
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── index.ts        # Function exports
│       ├── transcribe.ts   # Speech-to-Text service
│       ├── analyze.ts      # GPT analysis service
│       ├── report.ts       # Report generation
│       └── cleanup.ts      # Data deletion service
└── assets/                 # Fonts, images, icons
```

## Architecture

```
[Audio Recording] → [Upload to Cloud Storage]
                         ↓
              [Cloud Function: Transcribe]
                    (Speech-to-Text API)
                         ↓
               [Cloud Function: Analyze]
                    (OpenAI GPT-4o-mini)
                         ↓
              [Store Results in Firestore]
                         ↓
          [Real-time Sync → Mobile App UI]
                         ↓
            [Daily Report Generation]
```

## Privacy & Safety

- ⚠️ **Disclaimer**: This app provides guidance and insights, not professional or medical diagnosis.
- 🔐 All audio is deleted after transcription
- 🗑️ Users can delete all data at any time
- 📱 On-device processing when possible
- 🔒 Encrypted cloud transmission

## License

This project is part of a graduation project.

---

Made with ❤️ for better parenting
