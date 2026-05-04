// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
import { Audio } from 'expo-av';
import type { RecordingStatus } from 'expo-av/build/Audio/Recording.types';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface AudioRecording {
  uri: string;
  duration: number;
  timestamp: Date;
}

export interface RecordingFileDebugInfo {
  exists: boolean;
  size: number;
  path: string;
  format: string;
}

class AudioService {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      return permission.granted;
    } catch (err) {
      console.error('Error requesting audio permissions:', err);
      return false;
    }
  }

  async startRecording(onStatusUpdate?: (status: RecordingStatus) => void): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      this.recording = new Audio.Recording();
      this.recording.setProgressUpdateInterval(80);
      if (onStatusUpdate) {
        this.recording.setOnRecordingStatusUpdate(onStatusUpdate);
      }
      await this.recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      await this.recording.startAsync();
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<AudioRecording | null> {
    try {
      if (!this.recording) {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording.setOnRecordingStatusUpdate(null);

      if (!uri) {
        throw new Error('Recording URI is null');
      }

      const status = await this.recording.getStatusAsync();
      this.recording = null;

      return {
        uri,
        duration: (status.durationMillis || 0) / 1000,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async confirmSavedRecording(uri: string): Promise<RecordingFileDebugInfo> {
    if (Platform.OS === 'web') {
      throw new Error('Native file-system recording checks are not available on web.');
    }

    const fileInfo = await FileSystem.getInfoAsync(uri);
    const formatMatch = uri.split('?')[0].match(/\.[a-z0-9]+$/i);
    const format = formatMatch?.[0]?.toLowerCase() || 'unknown';
    const size = fileInfo.exists && 'size' in fileInfo ? fileInfo.size || 0 : 0;

    if (!fileInfo.exists || size <= 0) {
      throw new Error('Audio file is empty or missing');
    }

    if (format !== '.m4a' && format !== '.wav') {
      throw new Error(`Unsupported audio format ${format}. Expected .m4a or .wav.`);
    }

    return {
      exists: fileInfo.exists,
      size,
      path: uri,
      format,
    };
  }

  async playAudio(uri: string): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri });
      this.sound = sound;
      await this.sound.playAsync();
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  async stopPlayback(): Promise<void> {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
      }
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  }

  async deleteRecording(uri: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(uri);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
      throw error;
    }
  }

  async getRecordingDuration(uri: string): Promise<number> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      const status = await sound.getStatusAsync();
      await sound.unloadAsync();
      return status.isLoaded ? (status.durationMillis || 0) / 1000 : 0;
    } catch (error) {
      console.error('Failed to get recording duration:', error);
      return 0;
    }
  }

  isRecording(): boolean {
    return this.recording !== null;
  }

  isPlaying(): boolean {
    return this.sound !== null;
  }
}

export const audioService = new AudioService();
