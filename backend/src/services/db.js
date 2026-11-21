/**
 * db.js — single SQLite connection shared across the app.
 *
 * The database file path defaults to ./data/liquid-gold.db and can be
 * overridden via the DB_PATH environment variable.
 *
 * Schema (created on first run, idempotent):
 *
 *   users              – registered accounts
 *   surveys            – one-time risk survey result per user
 *   portfolios         – named investment portfolios per user
 *   history            – confirmed investment choices per user
 *   friendships        – friend requests & accepted friendships
 *   shadow_investments – "invest in a friend's portfolio" links
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'data', 'liquid-gold.db');

// Ensure the data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema bootstrap ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash        TEXT NOT NULL,
    name                 TEXT NOT NULL,
    created_at           TEXT NOT NULL,
    default_portfolio_id TEXT
  );

  CREATE TABLE IF NOT EXISTS surveys (
    user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    risk_profile      TEXT NOT NULL,
    hold_period_months INTEGER NOT NULL,
    completed_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS portfolios (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    hold_period_months INTEGER NOT NULL,
    risk_profile       TEXT NOT NULL,
    created_at         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS history (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date         TEXT NOT NULL,
    option_id    TEXT NOT NULL,
    option_name  TEXT NOT NULL,
    amount       REAL NOT NULL,
    risk_level   TEXT NOT NULL,
    why_it_fits  TEXT,
    data_source  TEXT,
    confirmed_at TEXT NOT NULL,
    portfolio_id TEXT,
    sold         INTEGER NOT NULL DEFAULT 0,
    sold_at      TEXT,
    sold_amount  REAL
  );

  CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
  CREATE INDEX IF NOT EXISTS idx_history_user    ON history(user_id, confirmed_at DESC);

  -- ── Friends ──────────────────────────────────────────────────────────────────
  -- status: 'pending' | 'accepted' | 'rejected'
  CREATE TABLE IF NOT EXISTS friendships (
    id          TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(requester_id, addressee_id)
  );

  CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
  CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

  -- ── Shadow investments ───────────────────────────────────────────────────────
  -- A shadow investment copies one specific history entry from a friend,
  -- OR mirrors their entire portfolio (target_type = 'portfolio').
  -- target_type: 'entry' | 'portfolio'
  CREATE TABLE IF NOT EXISTS shadow_investments (
    id              TEXT PRIMARY KEY,
    investor_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type     TEXT NOT NULL,
    target_id       TEXT NOT NULL,
    amount          REAL NOT NULL,
    created_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_shadow_investor ON shadow_investments(investor_id);
  CREATE INDEX IF NOT EXISTS idx_shadow_friend   ON shadow_investments(friend_id);
`);

// ── Idempotent migrations for existing databases ──────────────────────────────
// ALTER TABLE ignores the statement if the column already exists in SQLite ≥ 3.35
// but older SQLite throws — we catch and ignore that specific error.
try { db.exec(`ALTER TABLE users ADD COLUMN default_portfolio_id TEXT`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN cash_balance REAL NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE history ADD COLUMN portfolio_id TEXT`); } catch {}
try { db.exec(`ALTER TABLE history ADD COLUMN sold INTEGER NOT NULL DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE history ADD COLUMN sold_at TEXT`); } catch {}
try { db.exec(`ALTER TABLE history ADD COLUMN sold_amount REAL`); } catch {}
try { db.exec(`ALTER TABLE shadow_investments ADD COLUMN frequency TEXT NOT NULL DEFAULT 'one-time'`); } catch {}
try { db.exec(`ALTER TABLE shadow_investments ADD COLUMN portfolio_id TEXT`); } catch {}
try { db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users(name COLLATE NOCASE)`); } catch {}

module.exports = db;
