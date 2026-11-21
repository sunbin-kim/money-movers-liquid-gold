const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getHistory, addEntry, sellEntry, deleteEntry, unsellEntry, getCashBalance, adjustCashBalance, getPortfolioSummary } = require('../services/historyStore');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All history routes require authentication
router.use(requireAuth);

/**
 * GET /api/history
 * Returns: { history, summary, cashBalance }
 */
router.get('/', (req, res) => {
  const uid = req.user.id;
  res.json({
    history:     getHistory(uid),
    summary:     getPortfolioSummary(uid),
    cashBalance: getCashBalance(uid),
  });
});

/**
 * POST /api/history/confirm
 * Body: { optionId, optionName, amount, riskLevel, whyItFits, dataSource, portfolioId? }
 */
router.post(
  '/confirm',
  [
    body('optionId').notEmpty(),
    body('optionName').notEmpty(),
    body('amount').isFloat({ min: 1 }),
    body('riskLevel').isIn(['low', 'medium', 'high']),
    // fromCashBalance is optional — only present on reinvest flows
    body('fromCashBalance').optional().isFloat({ min: 0 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const uid = req.user.id;
    const entry = addEntry(uid, req.body);
    res.status(201).json({
      message: 'Choice confirmed and saved.',
      entry,
      summary: getPortfolioSummary(uid),
      cashBalance: getCashBalance(uid),
    });
  }
);

/**
 * POST /api/history/:id/sell
 * Marks an entry as sold at its current estimated value and credits cash balance.
 */
router.post(
  '/:id/sell',
  [param('id').notEmpty()],
  (req, res) => {
    const uid = req.user.id;
    const { currentPrice = null, purchasePrice = null } = req.body || {};
    const result = sellEntry(uid, req.params.id, currentPrice, purchasePrice);

    if (!result) {
      return res.status(404).json({ error: 'Entry not found.' });
    }
    if (result.alreadySold) {
      return res.status(409).json({ error: 'Already sold.', entry: result.entry });
    }

    res.json({
      message:     'Investment sold.',
      entry:       result.entry,
      cashBalance: result.cashBalance,
    });
  }
);

/**
 * DELETE /api/history/:id  — undo a buy (removes the entry entirely)
 */
router.delete('/:id', [param('id').notEmpty()], (req, res) => {
  const uid = req.user.id;
  const result = deleteEntry(uid, req.params.id);

  if (!result) {
    return res.status(404).json({ error: 'Entry not found.' });
  }
  if (result.error === 'already_sold') {
    return res.status(409).json({ error: 'Cannot undo a sale — entry is already sold.' });
  }

  res.json({
    message:     'Purchase undone.',
    cashBalance: result.cashBalance,
    summary:     getPortfolioSummary(uid),
  });
});

/**
 * PATCH /api/history/cash  — manually deposit or withdraw cash
 * Body: { delta: number }  positive = deposit, negative = withdrawal
 */
router.patch(
  '/cash',
  [
    body('delta')
      .isFloat()
      .withMessage('delta must be a number'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const uid = req.user.id;
    const { delta } = req.body;
    const cashBalance = adjustCashBalance(uid, parseFloat(delta));
    res.json({ cashBalance });
  }
);

/**
 * POST /api/history/:id/unsell  — undo a sell (restores entry to active)
 */
router.post('/:id/unsell', [param('id').notEmpty()], (req, res) => {
  const uid = req.user.id;
  const result = unsellEntry(uid, req.params.id);

  if (!result) {
    return res.status(404).json({ error: 'Entry not found.' });
  }
  if (result.error === 'not_sold') {
    return res.status(409).json({ error: 'Entry has not been sold.' });
  }

  res.json({
    message:     'Sale undone.',
    entry:       result.entry,
    cashBalance: result.cashBalance,
    summary:     getPortfolioSummary(uid),
  });
});

module.exports = router;
