// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
/**
 * Firebase Configuration
 * 
 * Replace these values with your actual Firebase project config.
 * Get these from: Firebase Console > Project Settings > General > Your apps
 * 
 * IMPORTANT: For production, use environment variables instead of hardcoding.
 */

// TODO: Replace with your Firebase project configuration
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/**
 * Setup Instructions:
 * 
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Enable these services:
 *    - Authentication (Email/Password)
 *    - Cloud Firestore
 *    - Cloud Storage
 *    - Cloud Functions (requires Blaze plan)
 * 4. Add a Web app to your project
 * 5. Copy the config object here
 * 6. Enable Google Cloud Speech-to-Text API in GCP Console
 * 7. Set OpenAI API key in Cloud Functions config:
 *    firebase functions:config:set openai.key="YOUR_OPENAI_KEY"
 */
