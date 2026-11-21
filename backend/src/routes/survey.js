/**
 * survey.js – one-time risk survey routes.
 *
 * GET  /api/survey          Returns the current user's survey result (or null).
 * POST /api/survey          Saves/overwrites the user's survey result.
 *                           Body: { riskProfile, holdPeriodMonths }
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { saveSurvey, getSurvey } = require('../services/userStore');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All survey routes require authentication
router.use(requireAuth);

// ── GET /api/survey ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const result = getSurvey(req.user.id);
  res.json({ survey: result }); // null if not yet completed
});

// ── POST /api/survey ──────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('riskProfile').isIn(['conservative', 'balanced', 'aggressive']),
    body('holdPeriodMonths').isInt({ min: 1 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { riskProfile, holdPeriodMonths } = req.body;
    const result = saveSurvey(req.user.id, { riskProfile, holdPeriodMonths });
    res.status(201).json({ survey: result });
  }
);

module.exports = router;
