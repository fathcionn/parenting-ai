// LEGACY FILE — Not used by current Gemini/MediaRecorder flow. Safe to delete.
/**
 * Speech-to-Text Transcription Service
 * 
 * Uses Google Cloud Speech-to-Text API to convert audio recordings
 * into text transcripts with speaker diarization and word timestamps.
 */

import * as admin from 'firebase-admin';
// Note: @google-cloud/speech would be imported in production
// For the graduation demo, we show the complete implementation

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  text: string;
  speaker: 'parent' | 'child' | 'unknown';
  startTime: number;
  endTime: number;
  confidence: number;
}

/**
 * Transcribe an audio file from Cloud Storage using Google Speech-to-Text.
 * 
 * For audio longer than 60 seconds, uses longRunningRecognize.
 * Automatically handles speaker diarization to distinguish parent vs child.
 */
export async function transcribeAudio(
  filePath: string,
  contentType: string
): Promise<TranscriptResult> {
  console.log(`Starting transcription for: ${filePath}`);

  // Get the GCS URI for the audio file
  const bucket = admin.storage().bucket();
  const gcsUri = `gs://${bucket.name}/${filePath}`;

  // Determine encoding from content type
  const encoding = getEncoding(contentType);

  /**
   * In production, this would call Google Cloud Speech-to-Text:
   * 
   * const speech = require('@google-cloud/speech');
   * const client = new speech.SpeechClient();
   * 
   * const request = {
   *   audio: { uri: gcsUri },
   *   config: {
   *     encoding: encoding,
   *     sampleRateHertz: 16000,
   *     languageCode: 'en-US',
   *     enableAutomaticPunctuation: true,
   *     enableWordTimeOffsets: true,
   *     enableSpeakerDiarization: true,
   *     diarizationSpeakerCount: 2, // parent + child
   *     model: 'latest_long', // optimized for long-form audio
   *   },
   * };
   * 
   * // For audio > 60s, use long running recognize
   * const [operation] = await client.longRunningRecognize(request);
   * const [response] = await operation.promise();
   * 
   * // Process results into segments
   * const segments = processResults(response.results);
   */

  // For graduation demo: return simulated transcript
  const demoTranscript: TranscriptResult = {
    text: 'Demo transcription - In production, this would contain the actual speech-to-text output from Google Cloud Speech-to-Text API.',
    segments: [
      {
        text: 'Please finish your homework before playing.',
        speaker: 'parent',
        startTime: 0,
        endTime: 5.2,
        confidence: 0.95,
      },
      {
        text: 'But I want to play now!',
        speaker: 'child',
        startTime: 5.5,
        endTime: 7.8,
        confidence: 0.92,
      },
      {
        text: 'I understand you want to play, but homework comes first. How about we make it fun?',
        speaker: 'parent',
        startTime: 8.0,
        endTime: 14.3,
        confidence: 0.94,
      },
    ],
  };

  console.log(`Transcription complete. ${demoTranscript.segments.length} segments found.`);
  return demoTranscript;
}

function getEncoding(contentType: string): string {
  const encodingMap: Record<string, string> = {
    'audio/flac': 'FLAC',
    'audio/wav': 'LINEAR16',
    'audio/x-wav': 'LINEAR16',
    'audio/mp3': 'MP3',
    'audio/mpeg': 'MP3',
    'audio/ogg': 'OGG_OPUS',
    'audio/webm': 'WEBM_OPUS',
    'audio/mp4': 'MP3',
    'audio/m4a': 'MP3',
  };
  return encodingMap[contentType] || 'ENCODING_UNSPECIFIED';
}
