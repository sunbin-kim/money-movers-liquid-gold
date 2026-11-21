/**
 * agentService.js
 *
 * The Liquid Gold AI agent.
 *
 * Flow:
 *  1. Receive: weeklyAmount, holdPeriodMonths, riskProfile
 *  2. Filter the investment universe to budget-affordable options
 *  3. Score each option against time horizon + risk profile
 *  4. Call IBM watsonx.ai to get real current market context + write plain "Why it fits" cards
 *  5. Return top-3 options with guardrails
 *
 * If WATSONX_API_KEY / WATSONX_PROJECT_ID are absent or the call fails,
 * the agent falls back to deterministic plain-language templates so the
 * app always works.
 */

let WatsonXAI = null;
let IamAuthenticator = null;
try {
  WatsonXAI = require('@ibm-cloud/watsonx-ai').WatsonXAI;
  IamAuthenticator = require('ibm-cloud-sdk-core').IamAuthenticator;
} catch (_) { /* SDK not installed */ }

const INVESTMENTS = require('../data/investments');

// ── Risk profile → numeric score ─────────────────────────────────────────────
const RISK_SCORES = { conservative: 1, balanced: 2, aggressive: 3 };

// ── Investment risk → numeric score ──────────────────────────────────────────
const INV_RISK_SCORES = { low: 1, medium: 2, high: 3 };

// ── Hold period buckets (months) ─────────────────────────────────────────────
function holdBucket(months) {
  if (months <= 3) return 'short';   // ≤ 3 months
  if (months <= 12) return 'medium'; // 4 – 12 months
  return 'long';                     // > 12 months
}

/**
 * Score a single investment for a given user profile.
 * Returns a number 0–100 (higher = better fit).
 */
function scoreInvestment(inv, { riskScore, bucket }) {
  const invRisk = INV_RISK_SCORES[inv.riskLevel];
  let score = 0;

  // ── Risk alignment (60 pts) ─────────────────────────────────────────────
  // Reward options whose risk level matches what the user said they want.
  // A perfect match scores 60; each step away loses 20 pts.
  const riskDiff = Math.abs(invRisk - riskScore);
  score += Math.max(0, 60 - riskDiff * 20);

  // ── Time horizon modifier (up to ±20 pts) ──────────────────────────────
  // Short holds favour stability — apply a mild penalty to high-risk options
  // only when the user chose a short hold AND is not aggressive themselves.
  // This never overrides an explicit aggressive risk preference.
  if (bucket === 'short' && riskScore < 3) {
    // Penalise options riskier than the user's comfort for short holds
    if (invRisk > riskScore) score -= (invRisk - riskScore) * 10;
  } else if (bucket === 'long') {
    // Long holds slightly reward higher-return options matching the user's risk
    if (invRisk === riskScore) score += 20;
    else if (Math.abs(invRisk - riskScore) === 1) score += 10;
  }
  // medium bucket: no extra modifier — risk alignment alone decides

  // ── Return potential bonus (20 pts) ────────────────────────────────────
  const annualMid = (inv.avgAnnualReturnLow + inv.avgAnnualReturnHigh) / 2;
  const holdYears = bucket === 'short' ? 0.25 : bucket === 'medium' ? 0.75 : 3;
  const expectedReturn = annualMid * holdYears;
  score += Math.min(20, Math.max(0, expectedReturn));

  return Math.min(100, Math.max(0, score));
}

const MAX_OPTIONS = 6;

/**
 * Filter investments by budget affordability, score them against the user's
 * risk profile and time horizon, and return the top results.
 *
 * Options are sorted purely by score (best fit first) so the user sees the
 * most relevant picks at the top regardless of ETF vs stock type.
 * Returns up to MAX_OPTIONS results.
 */
function selectTopOptions(weeklyAmount, riskProfile, holdPeriodMonths) {
  const riskScore = RISK_SCORES[riskProfile] || 2;
  const bucket = holdBucket(holdPeriodMonths);

  const affordable = INVESTMENTS.filter((inv) => inv.minAmount <= weeklyAmount);

  return affordable
    .map((inv) => ({
      ...inv,
      score: scoreInvestment(inv, { riskScore, bucket }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPTIONS);
}

/**
 * Returns a configured watsonx.ai service client, or null if credentials
 * are not set.
 */
function getWatsonxClient() {
  if (!WatsonXAI || !IamAuthenticator) return null;
  const apiKey = process.env.WATSONX_API_KEY;
  const serviceUrl = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
  if (!apiKey) return null;

  return WatsonXAI.newInstance({
    version: '2024-05-31',
    serviceUrl,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
  });
}

async function buildExplanation(inv, { weeklyAmount, holdPeriodMonths, riskProfile }) {
  const holdLabel =
    holdPeriodMonths <= 3
      ? `${holdPeriodMonths} month${holdPeriodMonths > 1 ? 's' : ''}`
      : holdPeriodMonths < 12
      ? `${holdPeriodMonths} months`
      : `${Math.round(holdPeriodMonths / 12)} year${holdPeriodMonths >= 24 ? 's' : ''}`;

  // Fallback template (always available, no API needed)
  const fallback = `With $${weeklyAmount}/week over ${holdLabel}, this ${inv.riskLevel}-risk option fits your ${riskProfile} comfort level. ${inv.plainReason} Labeled historical return: ${inv.avgAnnualReturnLow}% – ${inv.avgAnnualReturnHigh}% per year.`;

  const client = getWatsonxClient();
  if (!client) return fallback;

  try {
    const response = await client.textChat({
      modelId: process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct',
      projectId: process.env.WATSONX_PROJECT_ID,
      messages: [
        {
          role: 'system',
          content:
            'You are Liquid Gold, a plain-language investing assistant for Gen Z beginners. ' +
            'You have knowledge of current market conditions for major ETFs and asset classes. ' +
            'Write honest, jargon-free explanations (2–3 sentences, ≤80 words). ' +
            'Never promise returns. Always say "labeled historical return" not "expected return". ' +
            'Reference what this asset has actually been doing recently to make the explanation feel current and relevant.',
        },
        {
          role: 'user',
          content:
            `Investment: ${inv.name} (ticker-like: ${inv.id.toUpperCase()}, type: ${inv.type}, risk: ${inv.riskLevel}).\n` +
            `User profile: $${weeklyAmount}/week, hold for ${holdLabel}, risk comfort: ${riskProfile}.\n` +
            `Historical return range: ${inv.avgAnnualReturnLow}% to ${inv.avgAnnualReturnHigh}% per year.\n` +
            `Core description: ${inv.plainReason}\n\n` +
            `Task: Write a "Why it fits" card for this beginner. ` +
            `Start with a one-sentence note on what this asset has been doing in the current market environment (keep it factual and brief). ` +
            `Then explain in plain words why it fits this user's budget and risk profile. ` +
            `End with the labeled historical return range. Do NOT use the word "investment" more than once.`,
        },
      ],
      parameters: { max_new_tokens: 120, temperature: 0.4 },
    });

    return response.result?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Use watsonx.ai to get a brief current market summary sentence to show as
 * the data source note on the compare page.
 */
async function getMarketContextNote() {
  const client = getWatsonxClient();
  if (!client) return null;

  try {
    const response = await client.textChat({
      modelId: process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct',
      projectId: process.env.WATSONX_PROJECT_ID,
      messages: [
        {
          role: 'system',
          content: 'You are a financial data assistant. Be factual and very brief.',
        },
        {
          role: 'user',
          content:
            'In one sentence (≤25 words), describe the current broad U.S. market environment ' +
            '(bull/bear/sideways, any major theme like rate environment, sector leadership). ' +
            'Example format: "Markets are broadly higher in 2024, led by tech and AI; the Fed has begun cutting rates."',
        },
      ],
      parameters: { max_new_tokens: 60, temperature: 0.3 },
    });
    return response.result?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Main agent entry point.
 *
 * @param {object} params
 * @param {number} params.weeklyAmount      - dollars per week to invest
 * @param {number} params.holdPeriodMonths  - intended hold period in months
 * @param {string} params.riskProfile       - 'conservative' | 'balanced' | 'aggressive'
 * @returns {Promise<object>}
 */
async function getRecommendations({ weeklyAmount, holdPeriodMonths, riskProfile }) {
  // ── Guardrail: data freshness check ──────────────────────────────────────
  // In production this would call Alpha Vantage and check timestamps.
  // For MVP, static data always passes.
  const dataIsStale = false;
  if (dataIsStale) {
    return {
      guardrail: 'stale',
      message:
        'Market data could not be verified as current. Please review before deciding.',
      options: [],
    };
  }

  const topOptions = selectTopOptions(weeklyAmount, riskProfile, holdPeriodMonths);

  // Build explanations and market context note in parallel
  const [options, marketContextNote] = await Promise.all([
    Promise.all(
      topOptions.map(async (inv, index) => {
        const explanation = await buildExplanation(inv, {
          weeklyAmount,
          holdPeriodMonths,
          riskProfile,
        });

        return {
          rank: index + 1,
          id: inv.id,
          name: inv.name,
          ticker: inv.ticker || inv.id.toUpperCase(),
          type: inv.type,
          riskLevel: inv.riskLevel,
          stabilityLabel: inv.stabilityLabel,
          minAmount: inv.minAmount,
          returnRangeLow: inv.avgAnnualReturnLow,
          returnRangeHigh: inv.avgAnnualReturnHigh,
          whyItFits: explanation,
          glossaryTerms: inv.glossaryTerms,
          dataSource: inv.dataSource,
          lastUpdated: inv.lastUpdated,
          score: Math.round(inv.score),
          // ── Visual metadata ──────────────────────────────────────────────
          color:       inv.color       || '#f0b429',
          bgGradient:  inv.bgGradient  || 'linear-gradient(145deg,#152215,#1e311e)',
          emoji:       inv.emoji       || '📈',
          headline:    inv.headline    || inv.plainReason,
          newsLinks:   inv.newsLinks   || [],
          logoUrl:     inv.logoUrl     || null,
          imageUrl:    inv.imageUrl    || null,
          image2Url:   inv.image2Url   || null,
        };
      })
    ),
    getMarketContextNote(),
  ]);

  const dataSource = marketContextNote
    ? `AI market context · ${marketContextNote}`
    : 'Alpha Vantage (illustrative)';

  return {
    guardrail: 'ok',
    options,
    dataSource,
    lastUpdated: new Date().toISOString().split('T')[0],
    disclaimer:
      'Labeled historical returns are examples, not promises. No money moves until you confirm.',
  };
}

module.exports = { getRecommendations };
