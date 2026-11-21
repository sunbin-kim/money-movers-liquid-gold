/**
 * userStore.js — SQLite-backed store for users, surveys, and portfolios.
 *
 * All queries are synchronous (better-sqlite3 is sync-only by design).
 * The public API is identical to the old in-memory version so that
 * auth.js, survey.js, and portfolios.js routes need zero changes.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  // Users
  insertUser: db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?,?,?,?,?)'
  ),
  findByEmail:          db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE'),
  findByName:           db.prepare('SELECT * FROM users WHERE name = ? COLLATE NOCASE'),
  findById:             db.prepare('SELECT * FROM users WHERE id = ?'),
  updateUserName:       db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  updateUserEmail:      db.prepare('UPDATE users SET email = ? WHERE id = ?'),
  updateUserPassword:   db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
  setDefaultPortfolio:  db.prepare('UPDATE users SET default_portfolio_id = ? WHERE id = ?'),
  deleteUser:           db.prepare('DELETE FROM users WHERE id = ?'),

  // Surveys
  upsertSurvey: db.prepare(`
    INSERT INTO surveys (user_id, risk_profile, hold_period_months, completed_at)
    VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      risk_profile       = excluded.risk_profile,
      hold_period_months = excluded.hold_period_months,
      completed_at       = excluded.completed_at
  `),
  getSurvey: db.prepare('SELECT * FROM surveys WHERE user_id = ?'),

  // Portfolios
  insertPortfolio: db.prepare(
    'INSERT INTO portfolios (id, user_id, name, hold_period_months, risk_profile, created_at) VALUES (?,?,?,?,?,?)'
  ),
  listPortfolios:  db.prepare('SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at ASC'),
  findPortfolio:   db.prepare('SELECT * FROM portfolios WHERE id = ? AND user_id = ?'),
  updatePortfolio: db.prepare(
    'UPDATE portfolios SET name = ?, hold_period_months = ?, risk_profile = ? WHERE id = ? AND user_id = ?'
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a DB row (snake_case) to the public user shape (camelCase, no hash). */
function rowToPublicUser(row) {
  if (!row) return null;
  return {
    id:        row.id,
    email:     row.email,
    name:      row.name,
    createdAt: row.created_at,
  };
}

/** Convert a DB row to a user object including passwordHash (for auth checks). */
function rowToUser(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    email:              row.email,
    passwordHash:       row.password_hash,
    name:               row.name,
    createdAt:          row.created_at,
    defaultPortfolioId: row.default_portfolio_id || null,
  };
}

function rowToSurvey(row) {
  if (!row) return null;
  return {
    riskProfile:      row.risk_profile,
    holdPeriodMonths: row.hold_period_months,
    completedAt:      row.completed_at,
  };
}

function rowToPortfolio(row) {
  if (!row) return null;
  return {
    id:               row.id,
    name:             row.name,
    holdPeriodMonths: row.hold_period_months,
    riskProfile:      row.risk_profile,
    createdAt:        row.created_at,
  };
}

// ── Users ─────────────────────────────────────────────────────────────────────

function createUser({ email, passwordHash, name }) {
  const id  = uuidv4();
  const now = new Date().toISOString();
  stmts.insertUser.run(id, email.toLowerCase(), passwordHash, name, now);
  return rowToUser({ id, email: email.toLowerCase(), password_hash: passwordHash, name, created_at: now });
}

function findUserByEmail(email) {
  return rowToUser(stmts.findByEmail.get(email));
}

function findUserByName(name) {
  return rowToUser(stmts.findByName.get(name));
}

function findUserById(id) {
  return rowToUser(stmts.findById.get(id));
}

/** Strip the passwordHash before sending to the client. */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

function rowToPublicUser(row) {
  return publicUser(rowToUser(row));
}

// ── Survey ────────────────────────────────────────────────────────────────────

function saveSurvey(userId, { riskProfile, holdPeriodMonths }) {
  const now = new Date().toISOString();
  stmts.upsertSurvey.run(userId, riskProfile, holdPeriodMonths, now);
  return { riskProfile, holdPeriodMonths, completedAt: now };
}

function getSurvey(userId) {
  return rowToSurvey(stmts.getSurvey.get(userId));
}

// ── Portfolios ────────────────────────────────────────────────────────────────

function createPortfolio(userId, { name, holdPeriodMonths, riskProfile }) {
  const id  = uuidv4();
  const now = new Date().toISOString();
  stmts.insertPortfolio.run(id, userId, name, holdPeriodMonths, riskProfile, now);
  return { id, name, holdPeriodMonths, riskProfile, createdAt: now };
}

function getPortfolios(userId) {
  return stmts.listPortfolios.all(userId).map(rowToPortfolio);
}

function getPortfolioById(userId, portfolioId) {
  return rowToPortfolio(stmts.findPortfolio.get(portfolioId, userId));
}

function updatePortfolio(userId, portfolioId, { name, holdPeriodMonths, riskProfile }) {
  stmts.updatePortfolio.run(name, holdPeriodMonths, riskProfile, portfolioId, userId);
  return getPortfolioById(userId, portfolioId);
}

// ── Account updates ───────────────────────────────────────────────────────────

function updateUserName(userId, name) {
  stmts.updateUserName.run(name, userId);
  return findUserById(userId);
}

function updateUserEmail(userId, email) {
  stmts.updateUserEmail.run(email.toLowerCase(), userId);
  return findUserById(userId);
}

function updateUserPassword(userId, passwordHash) {
  stmts.updateUserPassword.run(passwordHash, userId);
}

function deleteUser(userId) {
  stmts.deleteUser.run(userId);
}

function setDefaultPortfolio(userId, portfolioId) {
  // portfolioId null clears the default
  stmts.setDefaultPortfolio.run(portfolioId, userId);
  return findUserById(userId);
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserByName,
  findUserById,
  publicUser,
  rowToPublicUser,
  saveSurvey,
  getSurvey,
  createPortfolio,
  getPortfolios,
  getPortfolioById,
  updatePortfolio,
  updateUserName,
  updateUserEmail,
  updateUserPassword,
  setDefaultPortfolio,
  deleteUser,
};
