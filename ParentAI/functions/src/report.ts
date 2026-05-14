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
  const dateStr = today.toISOString().split('T')[0];
  const chartData = {
    score: avgScore,
    comparedToPrevious,
    interactions: {
      positive: positiveCount,
      neutral: neutralCount,
      negative: negativeCount,
      total: totalInteractions,
    },
    toneDistribution,
  };
  const userEmail = await getUserEmail(userId);
  const emailSubject = `TalkWise Daily Parenting Report - ${dateStr}`;
  const emailHtml = buildReportEmailHtml({
    date: dateStr,
    score: avgScore,
    comparedToPrevious,
    toneDistribution,
    positiveCount,
    neutralCount,
    negativeCount,
    totalInteractions,
    topSuggestions,
  });
  const emailText = buildReportEmailText({
    date: dateStr,
    score: avgScore,
    comparedToPrevious,
    positiveCount,
    neutralCount,
    negativeCount,
    totalInteractions,
    topSuggestions,
  });

  // Save the report
  const reportRef = await admin.firestore()
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
      score: avgScore,
      topSuggestions,
      comparedToPrevious,
      chartData,
      emailSubject,
      emailHtml,
      emailText,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  if (userEmail) {
    await queueReportEmail(userEmail, emailSubject, emailHtml, emailText, userId, reportRef.id);
  }

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

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const userRecord = await admin.auth().getUser(userId);
    if (userRecord.email) return userRecord.email;
  } catch (error) {
    console.warn(`Could not load auth email for user ${userId}:`, error);
  }

  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const email = userDoc.data()?.email;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function toneRows(toneDistribution: Record<string, number>): string {
  const palette: Record<string, string> = {
    calm: '#22c55e',
    supportive: '#8b5cf6',
    neutral: '#94a3b8',
    frustrated: '#f59e0b',
    angry: '#ef4444',
  };

  return Object.entries(toneDistribution)
    .map(([tone, value]) => {
      const safeValue = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
      return `
        <tr>
          <td style="padding:10px 0;color:#d8cdee;font:600 13px Arial,sans-serif;text-transform:capitalize;">${escapeHtml(tone)}</td>
          <td style="padding:10px 0;width:68%;">
            <div style="height:12px;background:#332547;border-radius:999px;overflow:hidden;">
              <div style="height:12px;width:${safeValue}%;background:${palette[tone] || '#a78bfa'};border-radius:999px;"></div>
            </div>
          </td>
          <td style="padding:10px 0 10px 12px;color:#fbf8ff;font:800 13px Arial,sans-serif;text-align:right;">${safeValue}%</td>
        </tr>`;
    })
    .join('');
}

function interactionBar(label: string, value: number, total: number, color: string): string {
  const width = percent(value, total);
  return `
    <div style="margin:12px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#d8cdee;font:700 13px Arial,sans-serif;">
        <span>${escapeHtml(label)}</span><span>${value}</span>
      </div>
      <div style="height:14px;background:#332547;border-radius:999px;overflow:hidden;">
        <div style="height:14px;width:${width}%;background:${color};border-radius:999px;"></div>
      </div>
    </div>`;
}

function buildReportEmailHtml(input: {
  date: string;
  score: number;
  comparedToPrevious: number;
  toneDistribution: Record<string, number>;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalInteractions: number;
  topSuggestions: string[];
}): string {
  const trendLabel =
    input.comparedToPrevious > 0
      ? `+${input.comparedToPrevious} vs yesterday`
      : input.comparedToPrevious < 0
      ? `${input.comparedToPrevious} vs yesterday`
      : 'Steady vs yesterday';
  const safeScore = Math.max(0, Math.min(100, Math.round(input.score)));

  return `<!doctype html>
<html>
  <body style="margin:0;background:#110c1a;color:#fbf8ff;font-family:Arial,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:28px 18px;">
      <div style="background:#1c1428;border:1px solid #44345d;border-radius:24px;overflow:hidden;">
        <div style="padding:28px;background:#261b36;">
          <div style="color:#a78bfa;font:900 13px Arial,sans-serif;letter-spacing:1.6px;text-transform:uppercase;">TalkWise Daily Report</div>
          <h1 style="margin:10px 0 0;color:#fbf8ff;font:900 30px Arial,sans-serif;">Parenting communication snapshot</h1>
          <p style="margin:8px 0 0;color:#d8cdee;font:600 15px Arial,sans-serif;">${escapeHtml(input.date)}</p>
        </div>

        <div style="padding:28px;">
          <div style="display:inline-block;width:168px;height:168px;border-radius:50%;background:conic-gradient(#a78bfa ${safeScore}%, #332547 0);padding:12px;">
            <div style="height:144px;border-radius:50%;background:#1c1428;text-align:center;">
              <div style="padding-top:38px;color:#fbf8ff;font:900 44px Arial,sans-serif;">${safeScore}</div>
              <div style="color:#b7a8d0;font:800 13px Arial,sans-serif;">Score / 100</div>
            </div>
          </div>
          <div style="display:inline-block;vertical-align:top;max-width:390px;margin-left:24px;">
            <h2 style="margin:6px 0 8px;color:#fbf8ff;font:900 22px Arial,sans-serif;">${escapeHtml(trendLabel)}</h2>
            <p style="margin:0;color:#d8cdee;font:600 15px/1.55 Arial,sans-serif;">Your daily score summarizes tone, emotional intensity, and the balance between supportive and challenging interactions.</p>
          </div>

          <h3 style="margin:32px 0 14px;color:#fbf8ff;font:900 18px Arial,sans-serif;">Interaction balance</h3>
          ${interactionBar('Positive', input.positiveCount, input.totalInteractions, '#22c55e')}
          ${interactionBar('Neutral', input.neutralCount, input.totalInteractions, '#94a3b8')}
          ${interactionBar('Needs attention', input.negativeCount, input.totalInteractions, '#fb7185')}

          <h3 style="margin:32px 0 14px;color:#fbf8ff;font:900 18px Arial,sans-serif;">Tone distribution</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${toneRows(input.toneDistribution)}</table>

          <h3 style="margin:32px 0 14px;color:#fbf8ff;font:900 18px Arial,sans-serif;">Coach recommendations</h3>
          <div style="background:#261b36;border:1px solid #44345d;border-radius:18px;padding:18px;">
            ${input.topSuggestions
              .map((tip) => `<p style="margin:0 0 12px;color:#d8cdee;font:600 15px/1.55 Arial,sans-serif;">- ${escapeHtml(tip)}</p>`)
              .join('')}
          </div>
        </div>
      </div>
      <p style="color:#b7a8d0;font:600 12px/1.5 Arial,sans-serif;text-align:center;margin:18px 0 0;">This report is guidance, not medical or clinical advice.</p>
    </div>
  </body>
</html>`;
}

function buildReportEmailText(input: {
  date: string;
  score: number;
  comparedToPrevious: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalInteractions: number;
  topSuggestions: string[];
}): string {
  return [
    `TalkWise Daily Report - ${input.date}`,
    `Score: ${input.score}/100 (${input.comparedToPrevious >= 0 ? '+' : ''}${input.comparedToPrevious} vs yesterday)`,
    `Interactions: ${input.positiveCount} positive, ${input.neutralCount} neutral, ${input.negativeCount} needs attention, ${input.totalInteractions} total.`,
    'Coach recommendations:',
    ...input.topSuggestions.map((tip) => `- ${tip}`),
  ].join('\n');
}

async function queueReportEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  userId: string,
  reportId: string
): Promise<void> {
  await admin.firestore().collection('mail').add({
    to,
    message: {
      subject,
      html,
      text,
    },
    metadata: {
      type: 'daily-parenting-report',
      userId,
      reportId,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
