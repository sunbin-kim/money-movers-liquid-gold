/**
 * awardsEngine.js — computes portfolio awards / trophies.
 *
 * Awards are computed on-the-fly from history entries; nothing is persisted.
 *
 * Growth tier thresholds (% gain):
 *   Bronze   ≥  5%
 *   Silver   ≥ 10%
 *   Gold     ≥ 25%
 *   Platinum ≥ 50%
 *   Diamond  ≥ 100%
 *   Legend   ≥ 1000%  (the "moon" tier)
 *
 * Time periods evaluated:
 *   day  · week · month · 6months · year · all-time
 *
 * Special awards:
 *   • Participation Trophy — has at least one entry but 0% gain (illustrative)
 *   • First Step           — made their very first investment
 *   • Diversifier          — entries span all 3 risk levels
 *   • Consistent           — has entries in every evaluated period
 *   • High Roller          — a single entry ≥ $1 000
 */

const db = require('./db');

// ── Thresholds ────────────────────────────────────────────────────────────────

const GROWTH_TIERS = [
  { id: 'legend',   label: 'Legend',   emoji: '🌙', minPct: 1000, tier: 'legend'   },
  { id: 'diamond',  label: 'Diamond',  emoji: '💎', minPct: 100,  tier: 'diamond'  },
  { id: 'platinum', label: 'Platinum', emoji: '🪨', minPct: 50,   tier: 'platinum' },
  { id: 'gold',     label: 'Gold',     emoji: '🥇', minPct: 25,   tier: 'gold'     },
  { id: 'silver',   label: 'Silver',   emoji: '🥈', minPct: 10,   tier: 'silver'   },
  { id: 'bronze',   label: 'Bronze',   emoji: '🥉', minPct: 5,    tier: 'bronze'   },
];

const PERIODS = [
  { id: 'day',      label: 'Today',         days: 1    },
  { id: 'week',     label: 'This week',     days: 7    },
  { id: 'month',    label: 'This month',    days: 30   },
  { id: '6months',  label: 'Last 6 months', days: 182  },
  { id: 'year',     label: 'This year',     days: 365  },
  { id: 'alltime',  label: 'All time',      days: null },
];

// Illustrative growth rates per period (mirrors historyStore's flat 4.5%)
// In a real app these would come from live price feeds.
const PERIOD_GROWTH = {
  day:     0.0006,   // ~0.06% / day  → 4.5% over ~75 trading days
  week:    0.0045,   // ~0.45% / week
  month:   0.019,    // ~1.9%  / month
  '6months': 0.11,   // ~11%   / 6 months
  year:    0.045,    // 4.5%   / year  (same as summary)
  alltime: 0.045,    // 4.5%   flat overall
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const historyByUser = db.prepare(
  'SELECT * FROM history WHERE user_id = ? ORDER BY confirmed_at ASC'
);

const historyByPortfolio = db.prepare(
  'SELECT * FROM history WHERE user_id = ? AND portfolio_id = ? ORDER BY confirmed_at ASC'
);

const historyOriginal = db.prepare(
  "SELECT * FROM history WHERE user_id = ? AND (portfolio_id IS NULL OR portfolio_id = '') ORDER BY confirmed_at ASC"
);

const portfoliosByUser = db.prepare(
  'SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at ASC'
);

function cutoffDate(days) {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function filterByPeriod(entries, days) {
  // Only count active (unsold) entries for growth calculations
  const active = entries.filter((e) => !e.sold);
  if (days === null) return active;
  const cutoff = cutoffDate(days);
  return active.filter((e) => e.date >= cutoff);
}

function growthTierFor(pct) {
  for (const t of GROWTH_TIERS) {
    if (pct >= t.minPct) return t;
  }
  return null;
}

function tierColor(tier) {
  return {
    legend:   '#c084fc',
    diamond:  '#67e8f9',
    platinum: '#e2e8f0',
    gold:     '#f0b429',
    silver:   '#94a3b8',
    bronze:   '#cd7f32',
  }[tier] || '#7a9a7a';
}

// ── Core: build awards for a set of history entries ───────────────────────────

/**
 * Compute all awards for a single portfolio's history entries.
 * @param {string} portfolioId   - UUID of the portfolio (or 'all' for aggregate)
 * @param {string} portfolioName - Display name
 * @param {object[]} allEntries  - Full history rows (confirmed_at, date, amount, risk_level)
 * @returns {object}  { portfolioId, portfolioName, periods[], specialAwards[] }
 */
function computeAwardsForPortfolio(portfolioId, portfolioName, allEntries) {
  const periodResults = PERIODS.map(({ id, label, days }) => {
    const entries = filterByPeriod(allEntries, days);
    if (entries.length === 0) {
      return { periodId: id, periodLabel: label, totalInvested: 0, currentValue: 0, changePercent: 0, award: null };
    }

    const totalInvested = entries.reduce((s, e) => s + (e.amount || 0), 0);
    const growth        = PERIOD_GROWTH[id] ?? 0.045;
    const currentValue  = +(totalInvested * (1 + growth)).toFixed(2);
    const changePercent = +(growth * 100).toFixed(2);
    const award         = growthTierFor(changePercent);

    return {
      periodId:     id,
      periodLabel:  label,
      totalInvested,
      currentValue,
      changePercent,
      award: award
        ? { ...award, color: tierColor(award.tier), earnedAt: entries[entries.length - 1]?.confirmed_at }
        : null,
    };
  });

  // ── Special awards ────────────────────────────────────────────────────────
  const special = [];

  // Participation Trophy — has entries but no growth tier earned for any period
  const hasAnyGrowthAward = periodResults.some((p) => p.award !== null);
  if (allEntries.length > 0 && !hasAnyGrowthAward) {
    special.push({
      id:    'participation',
      label: 'Participation Trophy',
      emoji: '🏅',
      desc:  "You showed up! That's already more than most people.",
      color: '#78716c',
      tier:  'participation',
    });
  }

  // First Step — at least one entry exists
  if (allEntries.length >= 1) {
    special.push({
      id:    'first_step',
      label: 'First Step',
      emoji: '👣',
      desc:  'Made their very first investment. The journey of a thousand dollars starts with one.',
      color: '#86efac',
      tier:  'special',
    });
  }

  // Diversifier — entries span all 3 risk levels
  const riskLevels = new Set(allEntries.map((e) => e.risk_level));
  if (riskLevels.has('low') && riskLevels.has('medium') && riskLevels.has('high')) {
    special.push({
      id:    'diversifier',
      label: 'Diversifier',
      emoji: '🎯',
      desc:  'Invested across low, medium, and high risk. Textbook balance.',
      color: '#a5f3fc',
      tier:  'special',
    });
  }

  // High Roller — single entry ≥ $1,000
  const bigEntry = allEntries.find((e) => (e.amount || 0) >= 1000);
  if (bigEntry) {
    special.push({
      id:    'high_roller',
      label: 'High Roller',
      emoji: '💸',
      desc:  `Dropped $${bigEntry.amount.toFixed(0)} in a single move. Respect.`,
      color: '#fde68a',
      tier:  'special',
    });
  }

  // Veteran — 10+ entries
  if (allEntries.length >= 10) {
    special.push({
      id:    'veteran',
      label: 'Veteran',
      emoji: '🎖️',
      desc:  '10+ confirmed investments. This is not a phase.',
      color: '#c4b5fd',
      tier:  'special',
    });
  }

  // Consistency King — invested in at least 3 different calendar months
  const distinctMonths = new Set(allEntries.map((e) => (e.date || '').slice(0, 7)));
  if (distinctMonths.size >= 3) {
    special.push({
      id:    'consistent',
      label: 'Consistency King',
      emoji: '📆',
      desc:  `Invested across ${distinctMonths.size} different months. Discipline beats timing.`,
      color: '#fca5a5',
      tier:  'special',
    });
  }

  // Sold winner — sold at least one investment for a profit
  const soldForProfit = allEntries.filter(
    (e) => e.sold && e.sold_amount != null && e.sold_amount > e.amount
  );
  if (soldForProfit.length > 0) {
    special.push({
      id:    'profit_taker',
      label: 'Profit Taker',
      emoji: '💰',
      desc:  `Sold ${soldForProfit.length} investment${soldForProfit.length > 1 ? 's' : ''} at a profit. Cash money.`,
      color: '#86efac',
      tier:  'special',
    });
  }

  return {
    portfolioId,
    portfolioName,
    totalEntries: allEntries.length,
    periods: periodResults,
    specialAwards: special,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all awards for a user, broken down per portfolio plus an "Overall" aggregate.
 */
function getUserAwards(userId) {
  const allHistory    = historyByUser.all(userId);
  const portfolioRows = portfoliosByUser.all(userId);

  const results = [];

  // Per-portfolio breakdown using actual portfolio_id FK
  for (const p of portfolioRows) {
    const entries = historyByPortfolio.all(userId, p.id);
    results.push(computeAwardsForPortfolio(p.id, p.name, entries));
  }

  // "Original Portfolio" — entries with no portfolio_id set
  const originalEntries = historyOriginal.all(userId);
  if (originalEntries.length > 0 || portfolioRows.length === 0) {
    results.push(computeAwardsForPortfolio('original', '📁 Original Portfolio', originalEntries));
  }

  // "Overall" aggregate across all portfolios (all active entries)
  results.unshift(computeAwardsForPortfolio('overall', '🌐 Overall', allHistory));

  return results;
}

module.exports = { getUserAwards, GROWTH_TIERS, PERIODS, tierColor };
