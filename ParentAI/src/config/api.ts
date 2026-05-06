import { Platform } from 'react-native';

const LOCAL_API_BASE_URL = 'http://localhost:3001';
const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const REMOTE_API_BASE_URL = ENV_API_BASE_URL || 'https://YOUR_RAILWAY_URL_HERE.up.railway.app';

export const API_BASE_URL =
  ENV_API_BASE_URL
    ? ENV_API_BASE_URL
    : Platform.OS === 'web' && process.env.NODE_ENV === 'development'
    ? LOCAL_API_BASE_URL
    : REMOTE_API_BASE_URL;
