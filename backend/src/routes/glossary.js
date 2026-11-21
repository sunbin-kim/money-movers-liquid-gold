const express = require('express');
const GLOSSARY = require('../data/glossary');

const router = express.Router();

/**
 * GET /api/glossary
 * Returns all glossary terms.
 */
router.get('/', (_req, res) => {
  res.json(Object.values(GLOSSARY));
});

/**
 * GET /api/glossary/:term
 * Returns a single term definition (case-insensitive lookup).
 */
router.get('/:term', (req, res) => {
  const key = req.params.term.toLowerCase().replace(/-/g, ' ');
  const entry = GLOSSARY[key];
  if (!entry) {
    return res.status(404).json({ error: `Term "${req.params.term}" not found.` });
  }
  res.json(entry);
});

module.exports = router;
