/**
 * awards.js — trophy / awards routes.
 *
 * GET /api/awards          Your own awards (all portfolios + overall)
 * GET /api/awards/:userId  A friend's awards (requires accepted friendship)
 */

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getUserAwards } = require('../services/awardsEngine');
const { getFriends }    = require('../services/friendStore');

const router = express.Router();
router.use(requireAuth);

// ── GET /api/awards ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const awards = getUserAwards(req.user.id);
  res.json({ awards });
});

// ── GET /api/awards/:userId ───────────────────────────────────────────────────
router.get('/:userId', (req, res) => {
  const { userId } = req.params;

  // Allow viewing self
  if (userId !== req.user.id) {
    // Must be an accepted friend
    const friends = getFriends(req.user.id);
    const isFriend = friends.some((f) => f.friendId === userId);
    if (!isFriend) {
      return res.status(403).json({ error: 'You can only view awards of your friends.' });
    }
  }

  const awards = getUserAwards(userId);
  res.json({ awards });
});

module.exports = router;
