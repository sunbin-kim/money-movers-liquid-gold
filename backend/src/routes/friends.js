/**
 * friends.js — social / friends routes.
 *
 * All routes require authentication.
 *
 * GET    /api/friends                     List accepted friends + pending requests
 * GET    /api/friends/leaderboard         Growth leaderboard vs friends
 * GET    /api/friends/search?q=…          Search users by name or email
 * POST   /api/friends/request             Send a friend request  { addresseeId }
 * PATCH  /api/friends/request/:id         Accept / reject        { accept: true|false }
 * DELETE /api/friends/:friendId           Remove a friend
 *
 * GET    /api/friends/:friendId/portfolio  View a friend's history entries
 *
 * GET    /api/friends/shadow               List your shadow investments
 * POST   /api/friends/shadow               Create shadow investment
 *                                          { friendId, targetType, targetId, amount }
 * DELETE /api/friends/shadow/:id           Remove a shadow investment
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/authMiddleware');
const {
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
} = require('../services/friendStore');

const router = express.Router();
router.use(requireAuth);

// ── Helper ────────────────────────────────────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

// ── GET /api/friends ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const uid = req.user.id;
  res.json({
    friends:  getFriends(uid),
    pending:  getPendingRequests(uid),
    sent:     getSentRequests(uid),
  });
});

// ── GET /api/friends/leaderboard ─────────────────────────────────────────────
router.get('/leaderboard', (req, res) => {
  res.json({ leaderboard: getLeaderboard(req.user.id) });
});

// ── GET /api/friends/search?q=… ──────────────────────────────────────────────
router.get(
  '/search',
  [query('q').trim().notEmpty().withMessage('Search query is required.')],
  (req, res) => {
    if (!validate(req, res)) return;
    const results = searchUsers(req.query.q, req.user.id);
    res.json({ users: results });
  }
);

// ── GET /api/friends/shadow ───────────────────────────────────────────────────
router.get('/shadow', (req, res) => {
  res.json({ shadows: getShadowInvestments(req.user.id) });
});

// ── POST /api/friends/request ─────────────────────────────────────────────────
router.post(
  '/request',
  [body('addresseeId').notEmpty().withMessage('addresseeId is required.')],
  (req, res) => {
    if (!validate(req, res)) return;
    try {
      const request = sendFriendRequest(req.user.id, req.body.addresseeId);
      res.status(201).json({ request });
    } catch (err) {
      res.status(409).json({ error: err.message });
    }
  }
);

// ── PATCH /api/friends/request/:id ───────────────────────────────────────────
router.patch(
  '/request/:id',
  [body('accept').isBoolean().withMessage('accept must be true or false.')],
  (req, res) => {
    if (!validate(req, res)) return;
    try {
      const result = respondToRequest(req.params.id, req.user.id, req.body.accept);
      res.json({ friendship: result });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
);

// ── POST /api/friends/shadow ──────────────────────────────────────────────────
// (must be registered BEFORE /:friendId to avoid param shadowing)
router.post(
  '/shadow',
  [
    body('friendId').notEmpty(),
    body('targetType').isIn(['entry', 'portfolio']),
    body('targetId').notEmpty(),
    body('amount').isFloat({ min: 1 }),
    body('frequency').optional().isIn(['one-time', 'daily', 'weekly', 'monthly', 'yearly']),
    body('portfolioId').optional().isString(),
  ],
  (req, res) => {
    if (!validate(req, res)) return;
    const { friendId, targetType, targetId, amount, frequency, portfolioId } = req.body;
    try {
      const shadow = createShadowInvestment(req.user.id, friendId, targetType, targetId, amount, frequency, portfolioId);
      res.status(201).json({ shadow });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// ── DELETE /api/friends/shadow/:id ───────────────────────────────────────────
// (must be registered BEFORE DELETE /:friendId to avoid param shadowing)
router.delete('/shadow/:id', (req, res) => {
  try {
    deleteShadowInvestment(req.params.id, req.user.id);
    res.json({ message: 'Shadow investment removed.' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── GET /api/friends/:friendId/portfolio ──────────────────────────────────────
router.get('/:friendId/portfolio', (req, res) => {
  try {
    const history = getFriendHistory(req.user.id, req.params.friendId);
    res.json({ history });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

// ── DELETE /api/friends/:friendId ─────────────────────────────────────────────
router.delete('/:friendId', (req, res) => {
  try {
    removeFriend(req.user.id, req.params.friendId);
    res.json({ message: 'Friend removed.' });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
