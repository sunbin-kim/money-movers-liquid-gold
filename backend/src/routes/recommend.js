const express = require('express');
const { body, validationResult } = require('express-validator');
const { getRecommendations } = require('../services/agentService');

const router = express.Router();

/**
 * POST /api/recommend
 * Body: { weeklyAmount, holdPeriodMonths, riskProfile }
 */
router.post(
  '/',
  [
    body('weeklyAmount')
      .isFloat({ min: 1 })
      .withMessage('weeklyAmount must be at least $1'),
    body('holdPeriodMonths')
      .isInt({ min: 1, max: 360 })
      .withMessage('holdPeriodMonths must be between 1 and 360'),
    body('riskProfile')
      .isIn(['conservative', 'balanced', 'aggressive'])
      .withMessage('riskProfile must be conservative, balanced, or aggressive'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { weeklyAmount, holdPeriodMonths, riskProfile } = req.body;
      const result = await getRecommendations({
        weeklyAmount: parseFloat(weeklyAmount),
        holdPeriodMonths: parseInt(holdPeriodMonths, 10),
        riskProfile,
      });
      return res.json(result);
    } catch (err) {
      console.error('Agent error:', err);
      return res.status(500).json({ error: 'Agent failed to generate recommendations.' });
    }
  }
);

module.exports = router;
