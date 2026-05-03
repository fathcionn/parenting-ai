/**
 * Daily Report Generation Service
 * 
 * Aggregates all analyses from the day into a comprehensive
 * daily parenting report with scores, trends, and suggestions.
 */

import * as admin from 'firebase-admin';

export async function generateReport(userId: string): Promise<void> {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Get today's analyses
  const analysesSnapshot = await admin.firestore()
    .collection('users').doc(userId)
    .collection('analyses')
    .where('createdAt', '>=', startOfDay)
    .where('createdAt', '<=', endOfDay)
    .get();

  if (analysesSnapshot.empty) {
    console.log(`No analyses found for user ${userId} today. Skipping report.`);
    return;
  }

  // Aggregate data
  let totalScore = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  let totalInteractions = 0;
  const toneAccumulator: Record<string, number> = {
    calm: 0,
    supportive: 0,
    neutral: 0,
    frustrated: 0,
    angry: 0,
  };

  analysesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    totalScore += data.overallScore || 0;

    // Count interactions by impact
    (data.interactions || []).forEach((interaction: any) => {
      totalInteractions++;
      if (interaction.emotionalImpact === 'positive') positiveCount++;
      else if (interaction.emotionalImpact === 'negative') negativeCount++;
      else neutralCount++;
    });

    // Accumulate tone percentages
    const tone = data.toneBreakdown || {};
    Object.keys(toneAccumulator).forEach((key) => {
      toneAccumulator[key] += tone[key] || 0;
    });
  });

  // Average the scores and tones
  const numAnalyses = analysesSnapshot.docs.length;
  const avgScore = Math.round(totalScore / numAnalyses);

  const toneDistribution: Record<string, number> = {};
  Object.keys(toneAccumulator).forEach((key) => {
    toneDistribution[key] = Math.round(toneAccumulator[key] / numAnalyses);
  });

  // Get yesterday's report for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const yesterdayReport = await admin.firestore()
    .collection('users').doc(userId)
    .collection('reports')
    .where('date', '==', yesterdayStr)
    .limit(1)
    .get();

  let comparedToPrevious = 0;
  if (!yesterdayReport.empty) {
    const prevScore = yesterdayReport.docs[0].data().overallScore || 0;
    comparedToPrevious = avgScore - prevScore;
  }

  // Generate improvement tips based on tone distribution
  const topSuggestions = generateSuggestions(toneDistribution, avgScore);

  // Save the report
  const dateStr = today.toISOString().split('T')[0];
  await admin.firestore()
    .collection('users').doc(userId)
    .collection('reports')
    .add({
      date: dateStr,
      toneDistribution,
      positiveCount,
      negativeCount,
      neutralCount,
      totalInteractions,
      overallScore: avgScore,
      topSuggestions,
      comparedToPrevious,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`Daily report saved for user ${userId}. Score: ${avgScore}`);
}

/**
 * Generate personalized improvement suggestions based on tone patterns.
 */
function generateSuggestions(
  toneDistribution: Record<string, number>,
  overallScore: number
): string[] {
  const suggestions: string[] = [];

  // High frustration/anger
  if ((toneDistribution.frustrated || 0) + (toneDistribution.angry || 0) > 30) {
    suggestions.push(
      'Try the "pause and breathe" technique: Take 3 deep breaths before responding to challenging behavior.'
    );
    suggestions.push(
      'Use "I feel..." statements instead of "You always..." to express frustration constructively.'
    );
  }

  // Low supportive interactions
  if ((toneDistribution.supportive || 0) < 20) {
    suggestions.push(
      'Try to increase positive affirmations. Aim for 5 specific praises per day, like "I love how you shared with your sister."'
    );
  }

  // Good score — celebrate
  if (overallScore >= 75) {
    suggestions.push(
      'Great job maintaining a positive tone today! Keep up the excellent communication.'
    );
  }

  // General tips
  if (suggestions.length < 3) {
    const generalTips = [
      'Get down to your child\'s eye level when speaking to them — it shows respect and aids understanding.',
      'Practice active listening by repeating back what your child says before responding.',
      'Set aside 15 minutes of undivided, screen-free time with your child each day.',
      'Use "when...then" instead of "if...then" — it sounds more collaborative. Example: "When you finish dinner, then we can play."',
      'Validate emotions before correcting behavior: "I see you\'re frustrated. Let\'s find a better way to handle this."',
    ];
    
    while (suggestions.length < 3 && generalTips.length > 0) {
      const randomIndex = Math.floor(Math.random() * generalTips.length);
      suggestions.push(generalTips.splice(randomIndex, 1)[0]);
    }
  }

  return suggestions.slice(0, 3);
}
