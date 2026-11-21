import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || '';
const TOKEN_KEY = 'lg_auth_token';

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────────────
  /** POST /api/auth/register  { email, password, name } */
  register: (data) => axios.post(`${BASE}/api/auth/register`, data),

  /** POST /api/auth/login  { email, password } */
  login: (data) => axios.post(`${BASE}/api/auth/login`, data),

  /** GET /api/auth/me  (requires token) */
  getMe: (token) =>
    axios.get(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** PATCH /api/auth/me  { name?, email?, newPassword?, currentPassword? } */
  updateMe: (data) =>
    axios.patch(`${BASE}/api/auth/me`, data, { headers: authHeaders() }),

  /** DELETE /api/auth/me  { password } */
  deleteMe: (password) =>
    axios.delete(`${BASE}/api/auth/me`, { headers: authHeaders(), data: { password } }),

  // ── Survey ───────────────────────────────────────────────────────────────────
  /** GET /api/survey */
  getSurvey: () => axios.get(`${BASE}/api/survey`, { headers: authHeaders() }),

  /** POST /api/survey  { riskProfile, holdPeriodMonths } */
  saveSurvey: (data) =>
    axios.post(`${BASE}/api/survey`, data, { headers: authHeaders() }),

  // ── Portfolios ───────────────────────────────────────────────────────────────
  /** GET /api/portfolios */
  getPortfolios: () =>
    axios.get(`${BASE}/api/portfolios`, { headers: authHeaders() }),

  /** POST /api/portfolios  { name, holdPeriodMonths, riskProfile } */
  createPortfolio: (data) =>
    axios.post(`${BASE}/api/portfolios`, data, { headers: authHeaders() }),

  /** PATCH /api/portfolios/:id  { name, holdPeriodMonths, riskProfile } */
  updatePortfolio: (id, data) =>
    axios.patch(`${BASE}/api/portfolios/${id}`, data, { headers: authHeaders() }),

  /** PATCH /api/portfolios/:id/default  { default: true|false } */
  setDefaultPortfolio: (id, isDefault = true) =>
    axios.patch(`${BASE}/api/portfolios/${id}/default`, { default: isDefault }, { headers: authHeaders() }),

  // ── Recommendations ──────────────────────────────────────────────────────────
  /** POST /api/recommend */
  getRecommendations: (data) =>
    axios.post(`${BASE}/api/recommend`, data, { headers: authHeaders() }),

  // ── History ──────────────────────────────────────────────────────────────────
  /** GET /api/history */
  getHistory: () => axios.get(`${BASE}/api/history`, { headers: authHeaders() }),

  /** POST /api/history/confirm */
  confirmChoice: (data) =>
    axios.post(`${BASE}/api/history/confirm`, data, { headers: authHeaders() }),

  /** POST /api/history/:id/sell  { currentPrice?, purchasePrice? } */
  sellEntry: (id, prices = {}) =>
    axios.post(`${BASE}/api/history/${id}/sell`, prices, { headers: authHeaders() }),

  /** DELETE /api/history/:id  — undo a buy */
  deleteEntry: (id) =>
    axios.delete(`${BASE}/api/history/${id}`, { headers: authHeaders() }),

  /** POST /api/history/:id/unsell  — undo a sell */
  unsellEntry: (id) =>
    axios.post(`${BASE}/api/history/${id}/unsell`, {}, { headers: authHeaders() }),

  // ── Friends / Social ─────────────────────────────────────────────────────────
  /** GET /api/friends */
  getFriends: () =>
    axios.get(`${BASE}/api/friends`, { headers: authHeaders() }),

  /** GET /api/friends/leaderboard */
  getLeaderboard: () =>
    axios.get(`${BASE}/api/friends/leaderboard`, { headers: authHeaders() }),

  /** GET /api/friends/search?q=… */
  searchUsers: (q) =>
    axios.get(`${BASE}/api/friends/search`, { headers: authHeaders(), params: { q } }),

  /** POST /api/friends/request  { addresseeId } */
  sendFriendRequest: (addresseeId) =>
    axios.post(`${BASE}/api/friends/request`, { addresseeId }, { headers: authHeaders() }),

  /** PATCH /api/friends/request/:id  { accept } */
  respondToFriendRequest: (id, accept) =>
    axios.patch(`${BASE}/api/friends/request/${id}`, { accept }, { headers: authHeaders() }),

  /** DELETE /api/friends/:friendId */
  removeFriend: (friendId) =>
    axios.delete(`${BASE}/api/friends/${friendId}`, { headers: authHeaders() }),

  /** GET /api/friends/:friendId/portfolio */
  getFriendPortfolio: (friendId) =>
    axios.get(`${BASE}/api/friends/${friendId}/portfolio`, { headers: authHeaders() }),

  /** GET /api/friends/shadow */
  getShadowInvestments: () =>
    axios.get(`${BASE}/api/friends/shadow`, { headers: authHeaders() }),

  /** POST /api/friends/shadow  { friendId, targetType, targetId, amount } */
  createShadowInvestment: (data) =>
    axios.post(`${BASE}/api/friends/shadow`, data, { headers: authHeaders() }),

  /** DELETE /api/friends/shadow/:id */
  deleteShadowInvestment: (id) =>
    axios.delete(`${BASE}/api/friends/shadow/${id}`, { headers: authHeaders() }),

  // ── Awards / Trophies ────────────────────────────────────────────────────────
  /** GET /api/awards  — your own awards */
  getAwards: () =>
    axios.get(`${BASE}/api/awards`, { headers: authHeaders() }),

  /** GET /api/awards/:userId  — a friend's awards */
  getFriendAwards: (userId) =>
    axios.get(`${BASE}/api/awards/${userId}`, { headers: authHeaders() }),

  // ── Glossary / Chart ─────────────────────────────────────────────────────────
  /** GET /api/glossary/:term */
  lookupTerm: (term) =>
    axios.get(`${BASE}/api/glossary/${encodeURIComponent(term)}`),

  /** POST /api/auth/verify-password  { password } */
  verifyPassword: (password) =>
    axios.post(`${BASE}/api/auth/verify-password`, { password }, { headers: authHeaders() }),

  /** GET /api/chart/:symbol */
  getChartData: (symbol) =>
    axios.get(`${BASE}/api/chart/${encodeURIComponent(symbol)}`),

  /** GET /api/chart/:symbol/latest — most-recent close price */
  getLatestPrice: (symbol) =>
    axios.get(`${BASE}/api/chart/${encodeURIComponent(symbol)}/latest`),

  /** GET /api/browse */
  getBrowseOptions: () => axios.get(`${BASE}/api/browse`),

  /** GET /api/health */
  health: () => axios.get(`${BASE}/api/health`),
};
