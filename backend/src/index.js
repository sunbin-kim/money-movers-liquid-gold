require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const surveyRoutes = require('./routes/survey');
const portfolioRoutes = require('./routes/portfolios');
const recommendRoutes = require('./routes/recommend');
const historyRoutes = require('./routes/history');
const glossaryRoutes = require('./routes/glossary');
const chartRoutes = require('./routes/chart');
const friendsRoutes = require('./routes/friends');
const awardsRoutes  = require('./routes/awards');
const browseRoutes  = require('./routes/browse');

const app = express();

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/glossary', glossaryRoutes);
app.use('/api/chart', chartRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/awards',  awardsRoutes);
app.use('/api/browse',  browseRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Liquid Gold backend listening on http://localhost:${PORT}`);
});
