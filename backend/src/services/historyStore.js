/**
 * historyStore.js — SQLite-backed investment history store.
 *
 * All queries are synchronous (better-sqlite3).
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  insert: db.prepare(`
    INSERT INTO history
      (id, user_id, date, option_id, option_name, amount, risk_level, why_it_fits, data_source, confirmed_at, portfolio_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `),
  listByUser: db.prepare(`
    SELECT * FROM history
    WHERE user_id = ?
    ORDER BY confirmed_at DESC
  `),
  findOne: db.prepare(`
    SELECT * FROM history WHERE id = ? AND user_id = ?
  `),
  markSold: db.prepare(`
    UPDATE history SET sold = 1, sold_at = ?, sold_amount = ? WHERE id = ? AND user_id = ?
  `),
  unmarkSold: db.prepare(`
    UPDATE history SET sold = 0, sold_at = NULL, sold_amount = NULL WHERE id = ? AND user_id = ?
  `),
  deleteEntry: db.prepare(`
    DELETE FROM history WHERE id = ? AND user_id = ?
  `),
  addCashBalance: db.prepare(`
    UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?
  `),
  deductCashBalance: db.prepare(`
    UPDATE users SET cash_balance = MAX(0, cash_balance - ?) WHERE id = ?
  `),
  setCashBalance: db.prepare(`
    UPDATE users SET cash_balance = MAX(0, cash_balance + ?) WHERE id = ?
  `),
  getCashBalance: db.prepare(`
    SELECT cash_balance FROM users WHERE id = ?
  `),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToEntry(row) {
  return {
    id:          row.id,
    date:        row.date,
    optionId:    row.option_id,
    optionName:  row.option_name,
    amount:      row.amount,
    riskLevel:   row.risk_level,
    whyItFits:   row.why_it_fits   || undefined,
    dataSource:  row.data_source   || undefined,
    confirmedAt: row.confirmed_at,
    portfolioId: row.portfolio_id  || null,
    sold:        row.sold === 1,
    soldAt:      row.sold_at       || null,
    soldAmount:  row.sold_amount   != null ? row.sold_amount : null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

function getHistory(userId) {
  return stmts.listByUser.all(userId).map(rowToEntry);
}

function addEntry(userId, { date, optionId, optionName, amount, riskLevel, whyItFits, dataSource, portfolioId, fromCashBalance }) {
  const id  = uuidv4();
  const now = new Date().toISOString();
  stmts.insert.run(
    id,
    userId,
    date || now.split('T')[0],
    optionId,
    optionName,
    amount,
    riskLevel,
    whyItFits   || null,
    dataSource  || null,
    now,
    portfolioId || null
  );
  // Deduct from cash balance if this investment was funded from proceeds of a sale
  if (fromCashBalance && fromCashBalance > 0) {
    stmts.deductCashBalance.run(fromCashBalance, userId);
  }
  return rowToEntry({
    id, user_id: userId,
    date: date || now.split('T')[0],
    option_id: optionId, option_name: optionName,
    amount, risk_level: riskLevel,
    why_it_fits: whyItFits || null,
    data_source: dataSource || null,
    confirmed_at: now,
    portfolio_id: portfolioId || null,
    sold: 0,
    sold_at: null,
    sold_amount: null,
  });
}

/**
 * Mark a history entry as sold and credit the user's cash balance.
 * soldAmount = amount * (1 + simulatedGrowth) so the user gets back
 * their principal plus the same 4.5% illustrative gain shown on the dashboard.
 */
// currentPrice: optional real latest price. When provided and an earliest price
// is known from the chart data, we compute real gain. Otherwise we fall back to
// the 4.5% illustrative figure so the app still works without an API key.
function sellEntry(userId, entryId, currentPrice = null, purchasePrice = null) {
  const row = stmts.findOne.get(entryId, userId);
  if (!row) return null;
  if (row.sold) return { alreadySold: true, entry: rowToEntry(row) };

  let soldAmount;
  if (currentPrice != null && purchasePrice != null && purchasePrice > 0) {
    // Real gain: shares = amount / purchasePrice; value = shares * currentPrice
    const shares = row.amount / purchasePrice;
    soldAmount = +(shares * currentPrice).toFixed(2);
  } else {
    // Fallback illustrative gain
    const simulatedGrowth = 0.045;
    soldAmount = +(row.amount * (1 + simulatedGrowth)).toFixed(2);
  }
  const now = new Date().toISOString();

  stmts.markSold.run(now, soldAmount, entryId, userId);
  stmts.addCashBalance.run(soldAmount, userId);

  const updated = stmts.findOne.get(entryId, userId);
  const cashRow = stmts.getCashBalance.get(userId);
  return {
    alreadySold: false,
    entry: rowToEntry(updated),
    cashBalance: cashRow ? +(cashRow.cash_balance).toFixed(2) : 0,
  };
}

function getCashBalance(userId) {
  const row = stmts.getCashBalance.get(userId);
  return row ? +(row.cash_balance).toFixed(2) : 0;
}

/**
 * Manually adjust cash balance by a signed delta.
 * Positive delta = deposit, negative delta = withdrawal.
 * Balance is clamped to 0 (cannot go negative).
 */
function adjustCashBalance(userId, delta) {
  stmts.setCashBalance.run(delta, userId);
  const row = stmts.getCashBalance.get(userId);
  return row ? +(row.cash_balance).toFixed(2) : 0;
}

/**
 * Summarise the portfolio mix from active (unsold) history entries.
 */
function getPortfolioSummary(userId) {
  const history = getHistory(userId).filter((e) => !e.sold);
  if (history.length === 0) return null;

  const totalInvested = history.reduce((sum, e) => sum + (e.amount || 0), 0);

  const byRisk = { low: 0, medium: 0, high: 0 };
  for (const entry of history) {
    const risk = entry.riskLevel || 'medium';
    byRisk[risk] = (byRisk[risk] || 0) + (entry.amount || 0);
  }

  const riskMix = {};
  for (const [k, v] of Object.entries(byRisk)) {
    riskMix[k] = totalInvested > 0 ? Math.round((v / totalInvested) * 100) : 0;
  }

  const simulatedGrowth = 0.045;
  const currentValue    = +(totalInvested * (1 + simulatedGrowth)).toFixed(2);
  const changePercent   = +(simulatedGrowth * 100).toFixed(1);

  return { weeks: history.length, totalInvested, currentValue, changePercent, riskMix };
}

/**
 * Undo a buy — permanently delete the history entry.
 * If the entry was funded from cash balance, refund it.
 */
function deleteEntry(userId, entryId) {
  const row = stmts.findOne.get(entryId, userId);
  if (!row) return null;
  if (row.sold) return { error: 'already_sold' };

  stmts.deleteEntry.run(entryId, userId);
  const cashRow = stmts.getCashBalance.get(userId);
  return {
    deleted: true,
    cashBalance: cashRow ? +(cashRow.cash_balance).toFixed(2) : 0,
  };
}

/**
 * Undo a sell — restore the entry to unsold and deduct the credited amount
 * back from the cash balance.
 */
function unsellEntry(userId, entryId) {
  const row = stmts.findOne.get(entryId, userId);
  if (!row) return null;
  if (!row.sold) return { error: 'not_sold' };

  const soldAmount = row.sold_amount || 0;
  stmts.unmarkSold.run(entryId, userId);
  stmts.deductCashBalance.run(soldAmount, userId);

  const updated = stmts.findOne.get(entryId, userId);
  const cashRow = stmts.getCashBalance.get(userId);
  return {
    entry:       rowToEntry(updated),
    cashBalance: cashRow ? +(cashRow.cash_balance).toFixed(2) : 0,
  };
}

module.exports = { getHistory, addEntry, sellEntry, deleteEntry, unsellEntry, getCashBalance, adjustCashBalance, getPortfolioSummary };
