/**
 * ParentAI Cloud Functions
 * 
 * This module exports all Firebase Cloud Functions for the ParentAI app:
 * 1. onAudioUploaded - Transcribes audio via Google Speech-to-Text
 * 2. onTranscriptCreated - Analyzes transcript via OpenAI GPT
 * 3. generateDailyReport - Scheduled function for daily reports
 * 4. deleteUserData - Callable function for data deletion (privacy)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { transcribeAudio } from './transcribe';
import { analyzeTranscript } from './analyze';
import { generateReport } from './report';
import { deleteAllUserData } from './cleanup';

admin.initializeApp();

// ============================================================
// 1. TRANSCRIPTION: Triggered when audio is uploaded to Storage
// ============================================================
export const onAudioUploaded = functions.storage
  .object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;

    // Only process audio files in the recordings/ directory
    if (!filePath?.startsWith('recordings/') || !contentType?.startsWith('audio/')) {
      console.log('Skipping non-audio file:', filePath);
      return null;
    }

    console.log(`Processing audio file: ${filePath}`);

    try {
      // Extract userId and sessionId from path: recordings/{userId}/{sessionId}/{filename}
      const pathParts = filePath.split('/');
      const userId = pathParts[1];
      const sessionId = pathParts[2];

      // Update session status
      await admin.firestore()
        .collection('users').doc(userId)
        .collection('sessions').doc(sessionId)
        .update({ status: 'transcribing' });

      // Transcribe the audio
      const transcript = await transcribeAudio(filePath, contentType);

      // Save transcript to Firestore
      const transcriptRef = await admin.firestore()
        .collection('users').doc(userId)
        .collection('transcripts')
        .add({
          sessionId,
          text: transcript.text,
          segments: transcript.segments,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update session status
      await admin.firestore()
        .collection('users').doc(userId)
        .collection('sessions').doc(sessionId)
        .update({ status: 'analyzing' });

      // Delete the audio file (privacy: don't store audio permanently)
      await admin.storage().bucket().file(filePath).delete();
      console.log(`Deleted audio file: ${filePath}`);

      // Trigger analysis
      await analyzeTranscript(userId, sessionId, transcriptRef.id, transcript.text);

      // Update session status to complete
      await admin.firestore()
        .collection('users').doc(userId)
        .collection('sessions').doc(sessionId)
        .update({ status: 'complete' });

      console.log(`Completed processing for session: ${sessionId}`);
      return null;
    } catch (error) {
      console.error('Error processing audio:', error);
      return null;
    }
  });

// ============================================================
// 2. DAILY REPORT: Runs every day at midnight
// ============================================================
export const scheduledDailyReport = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('UTC')
  .onRun(async (_context) => {
    console.log('Generating daily reports for all users...');

    try {
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .get();

      const promises = usersSnapshot.docs.map(async (userDoc) => {
        try {
          await generateReport(userDoc.id);
          console.log(`Report generated for user: ${userDoc.id}`);
        } catch (err) {
          console.error(`Failed to generate report for user ${userDoc.id}:`, err);
        }
      });

      await Promise.all(promises);
      console.log('Daily report generation complete.');
      return null;
    } catch (error) {
      console.error('Error in daily report generation:', error);
      return null;
    }
  });

// ============================================================
// 3. DELETE USER DATA: Callable function for privacy compliance
// ============================================================
export const deleteMyData = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to delete data.'
    );
  }

  const userId = context.auth.uid;
  console.log(`Deleting all data for user: ${userId}`);

  try {
    await deleteAllUserData(userId);
    return { success: true, message: 'All your data has been deleted.' };
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw new functions.https.HttpsError('internal', 'Failed to delete data.');
  }
});
