/**
 * auth.js – register, login, and me routes.
 *
 * POST /api/auth/register  { email, password, name }
 * POST /api/auth/login     { email, password }
 * GET  /api/auth/me        (requires Bearer token)
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const {
  createUser,
  findUserByEmail,
  findUserByName,
  findUserById,
  publicUser,
  updateUserName,
  updateUserEmail,
  updateUserPassword,
  deleteUser,
} = require('../services/userStore');
const { requireAuth, SECRET } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 10;

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: '30d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('name').trim().notEmpty().withMessage('Username is required.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    if (findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    if (findUserByName(name)) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser({ email, passwordHash, name });
    const token = makeToken(user);

    res.status(201).json({ token, user: publicUser(user) });
  }
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = makeToken(user);
    res.json({ token, user: publicUser(user) });
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// ── PATCH /api/auth/me ────────────────────────────────────────────────────────
router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('email').optional().isEmail().normalizeEmail(),
    body('newPassword').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('currentPassword').optional().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, newPassword, currentPassword } = req.body;
    const userId = req.user.id;
    let user = findUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Name update
    if (name !== undefined) {
      user = updateUserName(userId, name);
    }

    // Email update — check for duplicates
    if (email !== undefined && email !== user.email) {
      const existing = findUserByEmail(email);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'That email is already in use.' });
      }
      user = updateUserEmail(userId, email);
    }

    // Password update — requires currentPassword verification
    if (newPassword !== undefined) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new one.' });
      }
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
      const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      updateUserPassword(userId, hash);
    }

    // Re-fetch to return current state
    const updated = findUserById(userId);
    res.json({ user: publicUser(updated) });
  }
);

// ── POST /api/auth/verify-password ───────────────────────────────────────────
// Verifies the current user's password without making any changes.
// Used by the undo-action confirmation modal.
router.post(
  '/verify-password',
  requireAuth,
  [body('password').notEmpty().withMessage('Password is required.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const match = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });

    res.json({ ok: true });
  }
);

// ── DELETE /api/auth/me ───────────────────────────────────────────────────────
router.delete(
  '/me',
  requireAuth,
  [body('password').notEmpty().withMessage('Password is required.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { password } = req.body;
    const user = findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    deleteUser(user.id);
    res.json({ message: 'Account deleted.' });
  }
);

module.exports = router;
