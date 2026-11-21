/**
 * GET /api/chart/:symbol
 *
 * Returns the last 90 days of daily closing prices for a given ticker symbol,
 * sourced from Alpha Vantage (TIME_SERIES_DAILY, compact output).
 *
 * If ALPHA_VANTAGE_API_KEY is not set, or the upstream call fails, it returns
 * a graceful fallback so the UI can degrade quietly.
 *
 * Response:
 *   { symbol, prices: [{ date: "YYYY-MM-DD", close: number }], source }
 */

const express = require('express');
const https = require('https');

const router = express.Router();

const TICKER_MAP = {
  spy: 'SPY',
  qqq: 'QQQ',
  'bond-etf': 'BND',
  vti: 'VTI',
  reits: 'VNQ',
  arkk: 'ARKK',
  gold: 'GLD',
  dividend: 'NOBL',
  // Individual stocks
  tsla: 'TSLA',
  aapl: 'AAPL',
  nvda: 'NVDA',
  amzn: 'AMZN',
  msft: 'MSFT',
  meta: 'META',
};

/**
 * Thin HTTPS GET helper that resolves with the parsed JSON body.
 */
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── GET /api/chart/:symbol/latest ─────────────────────────────────────────────
// Returns just the most-recent close price for quick P&L calculations.
router.get('/:symbol/latest', async (req, res) => {
  const rawSymbol = req.params.symbol.toLowerCase();
  const ticker = TICKER_MAP[rawSymbol] || rawSymbol.toUpperCase();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return res.json({ symbol: ticker, price: null, source: 'unavailable' });
  }

  try {
    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
      `&symbol=${encodeURIComponent(ticker)}&outputsize=compact` +
      `&apikey=${apiKey}`;

    const data = await httpsGetJson(url);

    if (data['Note'] || data['Information'] || !data['Time Series (Daily)']) {
      return res.json({ symbol: ticker, price: null, source: 'unavailable' });
    }

    const timeSeries = data['Time Series (Daily)'];
    const latestDate = Object.keys(timeSeries)[0];
    const price = parseFloat(timeSeries[latestDate]['4. close']);

    return res.json({ symbol: ticker, price, date: latestDate, source: 'Alpha Vantage' });
  } catch (err) {
    console.error('Alpha Vantage latest-price error:', err.message);
    return res.json({ symbol: ticker, price: null, source: 'unavailable' });
  }
});

router.get('/:symbol', async (req, res) => {
  const rawSymbol = req.params.symbol.toLowerCase();
  const ticker = TICKER_MAP[rawSymbol] || rawSymbol.toUpperCase();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return res.json({ symbol: ticker, prices: [], source: 'unavailable' });
  }

  try {
    const url =
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
      `&symbol=${encodeURIComponent(ticker)}&outputsize=compact` +
      `&apikey=${apiKey}`;

    const data = await httpsGetJson(url);

    // Alpha Vantage returns "Note" on rate-limit and "Information" on bad key
    if (data['Note'] || data['Information'] || !data['Time Series (Daily)']) {
      return res.json({ symbol: ticker, prices: [], source: 'unavailable' });
    }

    const timeSeries = data['Time Series (Daily)'];
    const prices = Object.entries(timeSeries)
      .slice(0, 90)                      // compact = last 100 days; take 90
      .map(([date, vals]) => ({
        date,
        close: parseFloat(vals['4. close']),
      }))
      .reverse();                        // oldest → newest

    return res.json({ symbol: ticker, prices, source: 'Alpha Vantage' });
  } catch (err) {
    console.error('Alpha Vantage chart error:', err.message);
    return res.json({ symbol: ticker, prices: [], source: 'unavailable' });
  }
});

module.exports = router;
