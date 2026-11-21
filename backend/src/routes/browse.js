/**
 * browse.js — returns the full investment universe for the Browse page.
 *
 * GET /api/browse
 * No auth required. No AI calls. Returns static metadata for all investments
 * so users can explore options before deciding to invest.
 */

const express = require('express');
const INVESTMENTS = require('../data/investments');

const router = express.Router();

router.get('/', (_req, res) => {
  const options = INVESTMENTS.map((inv) => ({
    id:               inv.id,
    name:             inv.name,
    ticker:           inv.ticker || inv.id.toUpperCase(),
    type:             inv.type,
    riskLevel:        inv.riskLevel,
    stabilityLabel:   inv.stabilityLabel,
    minAmount:        inv.minAmount,
    returnRangeLow:   inv.avgAnnualReturnLow,
    returnRangeHigh:  inv.avgAnnualReturnHigh,
    plainReason:      inv.plainReason,
    glossaryTerms:    inv.glossaryTerms || [],
    newsLinks:        inv.newsLinks     || [],
    // Visual
    color:            inv.color      || '#f0b429',
    bgGradient:       inv.bgGradient || 'linear-gradient(145deg,#152215,#1e311e)',
    emoji:            inv.emoji      || '📈',
    headline:         inv.headline   || inv.plainReason,
    logoUrl:          inv.logoUrl    || null,
    imageUrl:         inv.imageUrl   || null,
  }));

  res.json({ options });
});

module.exports = router;
