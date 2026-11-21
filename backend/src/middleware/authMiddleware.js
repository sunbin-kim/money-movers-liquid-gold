/**
 * authMiddleware.js
 * Verifies the JWT Bearer token and attaches req.user = { id, email, name }.
 */

const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'liquid-gold-dev-secret';

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth, SECRET };
