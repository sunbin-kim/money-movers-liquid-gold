/**
 * portfolios.js – portfolio management routes.
 *
 * GET   /api/portfolios          List all portfolios for the logged-in user.
 * POST  /api/portfolios          Create a new portfolio.
 *                                Body: { name, holdPeriodMonths, riskProfile }
 * GET   /api/portfolios/:id      Get a single portfolio.
 * PATCH /api/portfolios/:id      Update name / holdPeriodMonths / riskProfile.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { createPortfolio, getPortfolios, getPortfolioById, updatePortfolio, setDefaultPortfolio } = require('../services/userStore');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All portfolio routes require authentication
router.use(requireAuth);

// ── GET /api/portfolios ───────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({ portfolios: getPortfolios(req.user.id) });
});

// ── POST /api/portfolios ──────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Portfolio name is required.'),
    body('holdPeriodMonths').isInt({ min: 1 }),
    body('riskProfile').isIn(['conservative', 'balanced', 'aggressive']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, holdPeriodMonths, riskProfile } = req.body;
    const portfolio = createPortfolio(req.user.id, { name, holdPeriodMonths, riskProfile });
    res.status(201).json({ portfolio });
  }
);

// ── GET /api/portfolios/:id ───────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const portfolio = getPortfolioById(req.user.id, req.params.id);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
  res.json({ portfolio });
});

// ── PATCH /api/portfolios/:id ─────────────────────────────────────────────────
router.patch(
  '/:id',
  [
    body('name').trim().notEmpty().withMessage('Portfolio name is required.'),
    body('holdPeriodMonths').isInt({ min: 1 }),
    body('riskProfile').isIn(['conservative', 'balanced', 'aggressive']),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const existing = getPortfolioById(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Portfolio not found.' });

    const { name, holdPeriodMonths, riskProfile } = req.body;
    const portfolio = updatePortfolio(req.user.id, req.params.id, { name, holdPeriodMonths, riskProfile });
    res.json({ portfolio });
  }
);

// ── PATCH /api/portfolios/:id/default ────────────────────────────────────────
// Sets (or clears) the user's default portfolio.
// Body: { default: true|false }
router.patch('/:id/default', (req, res) => {
  const portfolio = getPortfolioById(req.user.id, req.params.id);
  if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });

  const makeDefault = req.body.default !== false; // default: true if omitted
  const portfolioId = makeDefault ? req.params.id : null;
  const user = setDefaultPortfolio(req.user.id, portfolioId);
  res.json({ defaultPortfolioId: user.defaultPortfolioId });
});

module.exports = router;
