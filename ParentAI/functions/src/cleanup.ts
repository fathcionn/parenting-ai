/**
 * Data Cleanup Service
 * 
 * Handles permanent deletion of all user data for privacy compliance.
 * This ensures users can exercise their right to be forgotten.
 */

import * as admin from 'firebase-admin';

/**
 * Delete all data associated with a user.
 * This includes: sessions, transcripts, analyses, reports, children, and any audio files.
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  const db = admin.firestore();
  const storage = admin.storage().bucket();

  console.log(`Starting complete data deletion for user: ${userId}`);

  // Delete all subcollections
  const subcollections = ['sessions', 'transcripts', 'analyses', 'reports', 'children'];

  for (const collectionName of subcollections) {
    const snapshot = await db
      .collection('users').doc(userId)
      .collection(collectionName)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    if (!snapshot.empty) {
      await batch.commit();
      console.log(`Deleted ${snapshot.docs.length} documents from ${collectionName}`);
    }
  }

  // Delete any remaining audio files in storage
  try {
    const [files] = await storage.getFiles({
      prefix: `recordings/${userId}/`,
    });

    for (const file of files) {
      await file.delete();
      console.log(`Deleted file: ${file.name}`);
    }
  } catch (error) {
    console.log('No audio files found or error deleting:', error);
  }

  // Delete the user document itself
  await db.collection('users').doc(userId).delete();

  console.log(`All data deleted for user: ${userId}`);
}

/**
 * Cleanup orphaned audio files that weren't deleted after transcription.
 * This runs as a safety net to ensure no audio lingers in storage.
 */
export async function cleanupOrphanedAudio(): Promise<void> {
  const storage = admin.storage().bucket();
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24); // Files older than 24 hours

  try {
    const [files] = await storage.getFiles({
      prefix: 'recordings/',
    });

    let deletedCount = 0;
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const created = new Date(metadata.timeCreated as string);

      if (created < cutoffTime) {
        await file.delete();
        deletedCount++;
        console.log(`Cleaned up orphaned file: ${file.name}`);
      }
    }

    console.log(`Orphaned audio cleanup complete. Deleted ${deletedCount} files.`);
  } catch (error) {
    console.error('Error during orphaned audio cleanup:', error);
  }
}
