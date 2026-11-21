/**
 * friendStore.js — SQLite-backed social / friends store.
 *
 * Features:
 *  • Send / accept / reject friend requests
 *  • List friends and pending requests
 *  • Search users by name or email (for adding friends)
 *  • Leaderboard: compare portfolio growth across friends
 *  • Shadow investing: mirror a friend's single entry OR whole portfolio
 *  • List the user's own shadow investments
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { addEntry } = require('./historyStore');

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  // Friendships
  insertFriendship: db.prepare(`
    INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?)
  `),
  findFriendship: db.prepare(`
    SELECT * FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?)
       OR (requester_id = ? AND addressee_id = ?)
    LIMIT 1
  `),
  updateStatus: db.prepare(`
    UPDATE friendships SET status = ?, updated_at = ?
    WHERE id = ?
  `),
  pendingForAddressee: db.prepare(`
    SELECT f.*, u.name as requester_name, u.email as requester_email
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `),
  sentByRequester: db.prepare(`
    SELECT f.*, u.name as addressee_name, u.email as addressee_email
    FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `),
  acceptedFriends: db.prepare(`
    SELECT
      f.id as friendship_id,
      f.status,
      f.created_at,
      CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END as friend_id,
      u.name  as friend_name,
      u.email as friend_email
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
    ORDER BY f.created_at ASC
  `),

  // User search (excludes self; max 20 results)
  searchUsers: db.prepare(`
    SELECT id, name, email FROM users
    WHERE (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)
      AND id != ?
    LIMIT 20
  `),

  // History for a given user (for leaderboard / mirror)
  historyByUser: db.prepare(`
    SELECT * FROM history WHERE user_id = ? ORDER BY confirmed_at DESC
  `),

  // Shadow investments
  insertShadow: db.prepare(`
    INSERT INTO shadow_investments (id, investor_id, friend_id, target_type, target_id, amount, frequency, portfolio_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `),
  listShadowByInvestor: db.prepare(`
    SELECT s.*, u.name as friend_name
    FROM shadow_investments s
    JOIN users u ON u.id = s.friend_id
    WHERE s.investor_id = ?
    ORDER BY s.created_at DESC
  `),
  deleteShadow: db.prepare(`
    DELETE FROM shadow_investments WHERE id = ? AND investor_id = ?
  `),
  existingShadow: db.prepare(`
    SELECT id FROM shadow_investments
    WHERE investor_id = ? AND friend_id = ? AND target_type = ? AND target_id = ?
    LIMIT 1
  `),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToFriendship(row) {
  if (!row) return null;
  return {
    id:          row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status:      row.status,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function historyToSummary(rows) {
  if (!rows || rows.length === 0) return { totalInvested: 0, currentValue: 0, changePercent: 0, entries: 0 };
  const totalInvested = rows.reduce((s, r) => s + (r.amount || 0), 0);
  // Same illustrative growth formula used in historyStore
  const simulatedGrowth = 0.045;
  const currentValue    = +(totalInvested * (1 + simulatedGrowth)).toFixed(2);
  const changePercent   = +(simulatedGrowth * 100).toFixed(1);
  return { totalInvested, currentValue, changePercent, entries: rows.length };
}

// ── Friendship API ────────────────────────────────────────────────────────────

function sendFriendRequest(requesterId, addresseeId) {
  if (requesterId === addresseeId) {
    throw new Error('Cannot add yourself as a friend.');
  }
  const existing = stmts.findFriendship.get(requesterId, addresseeId, addresseeId, requesterId);
  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already friends.');
    if (existing.status === 'pending')  throw new Error('Friend request already pending.');
    // If rejected previously, re-open it
    const now = new Date().toISOString();
    stmts.updateStatus.run('pending', now, existing.id);
    return { ...rowToFriendship(existing), status: 'pending', updatedAt: now };
  }
  const id  = uuidv4();
  const now = new Date().toISOString();
  stmts.insertFriendship.run(id, requesterId, addresseeId, 'pending', now, now);
  return { id, requesterId, addresseeId, status: 'pending', createdAt: now, updatedAt: now };
}

function respondToRequest(friendshipId, addresseeId, accept) {
  const existing = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId);
  if (!existing || existing.addressee_id !== addresseeId) {
    throw new Error('Friend request not found.');
  }
  if (existing.status !== 'pending') {
    throw new Error('Request already resolved.');
  }
  const status = accept ? 'accepted' : 'rejected';
  const now    = new Date().toISOString();
  stmts.updateStatus.run(status, now, friendshipId);
  return { ...rowToFriendship(existing), status, updatedAt: now };
}

function removeFriend(userId, friendId) {
  const existing = stmts.findFriendship.get(userId, friendId, friendId, userId);
  if (!existing || existing.status !== 'accepted') throw new Error('Not friends.');
  const now = new Date().toISOString();
  stmts.updateStatus.run('rejected', now, existing.id);
}

function getFriends(userId) {
  return stmts.acceptedFriends.all(userId, userId, userId, userId).map((row) => ({
    friendshipId: row.friendship_id,
    friendId:     row.friend_id,
    friendName:   row.friend_name,
    friendEmail:  row.friend_email,
    since:        row.created_at,
  }));
}

function getPendingRequests(userId) {
  return stmts.pendingForAddressee.all(userId).map((row) => ({
    id:            row.id,
    requesterId:   row.requester_id,
    requesterName: row.requester_name,
    requesterEmail:row.requester_email,
    createdAt:     row.created_at,
  }));
}

function getSentRequests(userId) {
  return stmts.sentByRequester.all(userId).map((row) => ({
    id:            row.id,
    addresseeId:   row.addressee_id,
    addresseeName: row.addressee_name,
    addresseeEmail:row.addressee_email,
    createdAt:     row.created_at,
  }));
}

function searchUsers(query, selfId) {
  const like = `%${query.toLowerCase()}%`;
  return stmts.searchUsers.all(like, like, selfId).map((u) => ({
    id:   u.id,
    name: u.name,
  }));
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

function getLeaderboard(userId) {
  const friends = getFriends(userId);
  // Include the user themselves
  const participants = [
    { friendId: userId, friendName: 'You', isSelf: true },
    ...friends.map((f) => ({ friendId: f.friendId, friendName: f.friendName, isSelf: false })),
  ];

  return participants
    .map(({ friendId, friendName, isSelf }) => {
      const rows    = stmts.historyByUser.all(friendId);
      const summary = historyToSummary(rows);
      return { userId: friendId, name: friendName, isSelf, ...summary };
    })
    .sort((a, b) => b.changePercent - a.changePercent);
}

// ── Friend portfolio view (for the "invest in friend" feature) ───────────────

function getFriendHistory(userId, friendId) {
  // Confirm they are friends first
  const link = stmts.findFriendship.get(userId, friendId, friendId, userId);
  if (!link || link.status !== 'accepted') throw new Error('Not friends with this user.');
  const rows = stmts.historyByUser.all(friendId);
  return rows.map((r) => ({
    id:         r.id,
    date:       r.date,
    optionId:   r.option_id,
    optionName: r.option_name,
    amount:     r.amount,
    riskLevel:  r.risk_level,
  }));
}

// ── Shadow investing ──────────────────────────────────────────────────────────

/**
 * targetType = 'entry'     → mirror a specific history entry
 * targetType = 'portfolio' → mirror a friend's entire portfolio; targetId = friendId
 */
function createShadowInvestment(investorId, friendId, targetType, targetId, amount, frequency, portfolioId) {
  const link = stmts.findFriendship.get(investorId, friendId, friendId, investorId);
  if (!link || link.status !== 'accepted') throw new Error('Not friends with this user.');
  if (amount <= 0) throw new Error('Amount must be positive.');

  const existing = stmts.existingShadow.get(investorId, friendId, targetType, targetId);
  if (existing) throw new Error('Already shadowing this investment.');

  const id   = uuidv4();
  const now  = new Date().toISOString();
  const freq = frequency  || 'one-time';
  const pid  = portfolioId || null;
  stmts.insertShadow.run(id, investorId, friendId, targetType, targetId, amount, freq, pid, now);

  // Create real history entries for the investor so the dashboard and portfolio update immediately.
  if (targetType === 'portfolio') {
    // Mirror all active (unsold) holdings from the friend's portfolio.
    const friendRows = stmts.historyByUser.all(friendId).filter((r) => !r.sold);
    if (friendRows.length === 0) {
      // Friend has no active holdings — create a single generic placeholder entry.
      addEntry(investorId, {
        optionId:    friendId,
        optionName:  `Mirrored portfolio`,
        amount,
        riskLevel:   'medium',
        whyItFits:   `Shadowing a friend's portfolio`,
        portfolioId: pid,
      });
    } else {
      // Distribute amount proportionally across the friend's active holdings.
      const friendTotal = friendRows.reduce((s, r) => s + (r.amount || 0), 0);
      for (const row of friendRows) {
        const share = friendTotal > 0 ? (row.amount / friendTotal) * amount : amount / friendRows.length;
        addEntry(investorId, {
          optionId:    row.option_id,
          optionName:  row.option_name,
          amount:      +share.toFixed(2),
          riskLevel:   row.risk_level || 'medium',
          whyItFits:   `Mirroring a friend's portfolio`,
          dataSource:  row.data_source || undefined,
          portfolioId: pid,
        });
      }
    }
  } else {
    // Mirror a single specific entry from the friend's history.
    const row = db.prepare('SELECT * FROM history WHERE id = ?').get(targetId);
    if (row) {
      addEntry(investorId, {
        optionId:    row.option_id,
        optionName:  row.option_name,
        amount,
        riskLevel:   row.risk_level || 'medium',
        whyItFits:   `Shadowing a friend's investment`,
        dataSource:  row.data_source || undefined,
        portfolioId: pid,
      });
    }
  }

  return { id, investorId, friendId, targetType, targetId, amount, frequency: freq, portfolioId: pid, createdAt: now };
}

function getShadowInvestments(investorId) {
  return stmts.listShadowByInvestor.all(investorId).map((r) => ({
    id:          r.id,
    friendId:    r.friend_id,
    friendName:  r.friend_name,
    targetType:  r.target_type,
    targetId:    r.target_id,
    amount:      r.amount,
    frequency:   r.frequency   || 'one-time',
    portfolioId: r.portfolio_id || null,
    createdAt:   r.created_at,
  }));
}

function deleteShadowInvestment(id, investorId) {
  const info = stmts.deleteShadow.run(id, investorId);
  if (info.changes === 0) throw new Error('Shadow investment not found.');
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  getSentRequests,
  searchUsers,
  getLeaderboard,
  getFriendHistory,
  createShadowInvestment,
  getShadowInvestments,
  deleteShadowInvestment,
};
