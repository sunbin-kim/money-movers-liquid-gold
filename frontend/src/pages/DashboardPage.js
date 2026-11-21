import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import RiskBadge from '../components/RiskBadge';
import StockChart from '../components/StockChart';
import UndoConfirmModal from '../components/UndoConfirmModal';

const C = {
  gold:    'var(--gold)',
  goldBtn: 'linear-gradient(135deg,#c98a00,#f0b429)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  surface: 'var(--surface)',
  surface2:'var(--surface-2)',
  border:  'var(--border)',
  green:   'var(--low)',
  red:     'var(--high)',
};

const TIME_RANGES = [
  { id: 'all',    label: 'All time', days: null },
  { id: '1y',     label: '1 year',   days: 365  },
  { id: '6m',     label: '6 months', days: 182  },
  { id: '1m',     label: '1 month',  days: 30   },
  { id: '1w',     label: '1 week',   days: 7    },
  { id: '1d',     label: 'Today',    days: 1    },
];

function cutoffDate(days) {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [portfolios, setPortfolios]   = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [activeRange, setActiveRange]       = useState('all');
  // 'all' | '' (original) | '<portfolio-id>'
  const [activePortfolio, setActivePortfolio] = useState('all');

  async function load() {
    try {
      const [histRes, portRes] = await Promise.all([
        api.getHistory(),
        api.getPortfolios(),
      ]);
      setData(histRes.data);
      setCashBalance(histRes.data.cashBalance || 0);
      setPortfolios(portRes.data.portfolios || []);
    } catch {
      setData({ history: [], summary: null, cashBalance: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // All portfolio tabs: All · Original Portfolio · <named portfolios>
  const portfolioTabs = useMemo(() => [
    { id: 'all', name: 'All portfolios' },
    { id: '',    name: 'Original Portfolio' },
    ...portfolios.map((p) => ({ id: p.id, name: p.name })),
  ], [portfolios]);

  // Filter history by time range, active portfolio tab, and exclude sold entries from stats
  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    let list = data.history;

    // Time range
    const range = TIME_RANGES.find((r) => r.id === activeRange);
    if (range?.days) {
      const cutoff = cutoffDate(range.days);
      list = list.filter((e) => e.date >= cutoff);
    }

    // Portfolio tab
    if (activePortfolio !== 'all') {
      list = list.filter((e) => (e.portfolioId || '') === activePortfolio);
    }

    return list;
  }, [data, activeRange, activePortfolio]);

  // Active (unsold) entries — used for stats and holdings table
  const activeHistory = useMemo(() => filteredHistory.filter((e) => !e.sold), [filteredHistory]);

  // Holdings: group active entries by optionId, sum invested amounts
  const holdings = useMemo(() => {
    const map = {};
    for (const e of activeHistory) {
      if (!map[e.optionId]) {
        map[e.optionId] = {
          optionId:    e.optionId,
          optionName:  e.optionName,
          riskLevel:   e.riskLevel,
          portfolioId: e.portfolioId || null,
          totalInvested: 0,
          entries: 0,
          entryIds: [], // { id, amount } — used by sell modal
        };
      }
      map[e.optionId].totalInvested += e.amount || 0;
      map[e.optionId].entries++;
      map[e.optionId].entryIds.push({ id: e.id, amount: e.amount || 0 });
    }
    return Object.values(map).sort((a, b) => b.totalInvested - a.totalInvested);
  }, [activeHistory]);

  const filteredSummary = useMemo(() => {
    if (activeHistory.length === 0) return null;
    const totalInvested = activeHistory.reduce((s, e) => s + (e.amount || 0), 0);
    const simulatedGrowth = 0.045;
    const currentValue    = +(totalInvested * (1 + simulatedGrowth)).toFixed(2);
    const changePercent   = +(simulatedGrowth * 100).toFixed(1);
    const totalGain       = +(currentValue - totalInvested).toFixed(2);
    // Unique stock positions (from activeHistory, so excludes sold)
    const positions = new Set(activeHistory.map((e) => e.optionId)).size;
    // Biggest single holding by total invested
    const holdingMap = {};
    for (const e of activeHistory) {
      holdingMap[e.optionId] = (holdingMap[e.optionId] || { name: e.optionName, total: 0 });
      holdingMap[e.optionId].total += e.amount || 0;
    }
    const biggest = Object.values(holdingMap).sort((a, b) => b.total - a.total)[0] || null;
    // Total realised (sold) proceeds within the filtered time window
    const totalSold = filteredHistory
      .filter((e) => e.sold && e.soldAmount != null)
      .reduce((s, e) => s + e.soldAmount, 0);
    return { weeks: activeHistory.length, totalInvested, currentValue, changePercent, totalGain, positions, biggest, totalSold };
  }, [activeHistory, filteredHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 animate-spin"
          style={{ borderColor: C.gold, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const { history } = data || {};
  const empty = !history || history.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: C.text }}>⑥ Your dashboard</h1>
        <p className="text-sm" style={{ color: C.muted }}>What you chose and how it's doing.</p>
      </div>

      {/* ── Cash balance banner ─────────────────────────────────────────────── */}
      {cashBalance > 0 && (
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'var(--surface-2)', border: `1px solid ${C.green}44` }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.green }}>
              💵 Cash balance
            </p>
            <p className="text-2xl font-black mt-0.5" style={{ color: C.green }}>
              ${cashBalance.toFixed(2)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              From sold investments · available to reinvest
            </p>
          </div>
          <button
            onClick={() => navigate('/start', { state: { reinvestAmount: cashBalance } })}
            className="px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
            style={{ background: C.green + '22', color: C.green, border: `1px solid ${C.green}44` }}
          >
            Reinvest →
          </button>
        </div>
      )}

      {/* ── Portfolio overview cards ─────────────────────────────────────────── */}
      {portfolios.length > 0 && (
        <PortfolioGrid
          portfolios={portfolios}
          history={data?.history || []}
          activePortfolio={activePortfolio}
          onSelect={(id) => setActivePortfolio(id)}
          onNew={() => navigate('/start')}
        />
      )}

      {empty ? (
        <EmptyState navigate={navigate} />
      ) : (
        <>
          {/* ── Portfolio tabs ──────────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {portfolioTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePortfolio(tab.id)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={
                  activePortfolio === tab.id
                    ? { background: C.gold, color: 'var(--bg)', borderColor: C.gold }
                    : { background: C.surface, color: C.muted, borderColor: C.border }
                }
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* ── Time range filter ───────────────────────────────────────────── */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRange(r.id)}
                className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={
                  activeRange === r.id
                    ? { background: C.surface2, color: C.gold, border: `1px solid ${C.border}` }
                    : { color: C.muted, border: '1px solid transparent' }
                }
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* ── Summary + Quick Stats ───────────────────────────────────────── */}
          {filteredSummary ? (
            <>
              <SummaryCard
                summary={filteredSummary}
                history={activeHistory}
                rangeLabel={TIME_RANGES.find(r => r.id === activeRange)?.label}
              />
              <QuickStatsBar summary={filteredSummary} />
            </>
          ) : (
            <div className="card text-center py-8" style={{ color: C.muted }}>
              <p>No active investments in this view.</p>
            </div>
          )}

          {/* ── Holdings table ──────────────────────────────────────────────── */}
          {holdings.length > 0 && (
            <HoldingsTable
              holdings={holdings}
              portfolios={portfolios}
              onReload={() => { setLoading(true); load(); }}
              onSell={(entryId, soldAmount, newBalance) => {
                setCashBalance(newBalance);
                setData((prev) => ({
                  ...prev,
                  history: prev.history.map((e) =>
                    e.id === entryId
                      ? { ...e, sold: true, soldAt: new Date().toISOString(), soldAmount }
                      : e
                  ),
                }));
              }}
            />
          )}

          <HistoryList
            history={filteredHistory}
            portfolios={portfolios}
            onSell={(entryId, soldAmount, newBalance) => {
              setCashBalance(newBalance);
              setData((prev) => ({
                ...prev,
                history: prev.history.map((e) =>
                  e.id === entryId
                    ? { ...e, sold: true, soldAt: new Date().toISOString(), soldAmount }
                    : e
                ),
              }));
            }}
            onReload={() => {
              setLoading(true);
              load();
            }}
          />
        </>
      )}
    </div>
  );
}

// ── Holdings table ────────────────────────────────────────────────────────────
// Time-range definitions for the inline chart filter
const HOLDING_RANGES = [
  { id: '1w',  label: '1W',  days: 5  },  // 5 trading days ≈ 1 calendar week
  { id: '1m',  label: '1M',  days: 22 },  // ~22 trading days per month
  { id: '3m',  label: '3M',  days: 66 },
  { id: '6m',  label: '6M',  days: 90 },  // capped at max data returned (90 trading days)
  { id: '1y',  label: '1Y',  days: 90 },  // same cap — backend returns max 90 days
];

// Format a YYYY-MM-DD date string for x-axis labels
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Inline SVG sparkline with live price data, time-range tabs, and x/y axes
function HoldingChart({ symbol, activeRange, onRangeChange, allPrices }) {
  // SVG coordinate space
  const W      = 400;
  const H      = 110;
  const LEFT   = 42;   // y-axis label width
  const RIGHT  = 6;
  const TOP    = 8;
  const BOTTOM = 22;   // x-axis label height
  const CW     = W - LEFT - RIGHT;   // chart width
  const CH     = H - TOP - BOTTOM;   // chart height

  if (!allPrices || allPrices.length < 2) {
    return (
      <div className="rounded-xl flex items-center justify-center"
        style={{ height: H, background: C.surface2 }}>
        <p className="text-xs" style={{ color: C.muted }}>Chart unavailable</p>
      </div>
    );
  }

  const rangeDef = HOLDING_RANGES.find(r => r.id === activeRange) || HOLDING_RANGES[0];
  const rawSlice = allPrices.slice(-rangeDef.days);
  // Always need at least 2 points
  const slice    = rawSlice.length >= 2 ? rawSlice : allPrices.slice(-2);

  const closes = slice.map(p => p.close);
  const dates  = slice.map(p => p.date);

  const minV = Math.min(...closes);
  const maxV = Math.max(...closes);
  const rng  = maxV - minV || minV * 0.01 || 1;

  // Add a small padding so the line never clips the top/bottom edge
  const padded = rng * 0.08;
  const lo = minV - padded;
  const hi = maxV + padded;
  const rngP = hi - lo;

  const toX = (i) => LEFT + (i / (closes.length - 1)) * CW;
  const toY = (v) => TOP + (1 - (v - lo) / rngP) * CH;

  const pts    = closes.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const line   = `M ${pts.replace(/ /g, ' L ')}`;
  const fill   = `${line} L ${toX(closes.length - 1)},${TOP + CH} L ${toX(0)},${TOP + CH} Z`;

  const isUp      = closes[closes.length - 1] >= closes[0];
  const changePct = (((closes[closes.length - 1] - closes[0]) / closes[0]) * 100).toFixed(2);
  const lineColor = isUp ? C.green : C.red;
  const fillId    = `hgrad-${symbol}-${activeRange}`;

  // Y-axis: 3 horizontal grid lines at 0%, 50%, 100% of range
  const yTicks = [0, 0.5, 1].map(t => ({
    y:     TOP + (1 - t) * CH,
    label: `$${(lo + t * rngP).toFixed(closes[0] > 100 ? 0 : 2)}`,
  }));

  // X-axis: show first, middle, last date labels
  const xTicks = (() => {
    const n = closes.length;
    const idxs = n <= 2
      ? [0, n - 1]
      : [0, Math.floor((n - 1) / 2), n - 1];
    return idxs.map(i => ({ x: toX(i), label: fmtDate(dates[i]) }));
  })();

  return (
    <div>
      {/* Time-range tabs */}
      <div className="flex gap-1 mb-2">
        {HOLDING_RANGES.map(r => (
          <button
            key={r.id}
            onClick={() => onRangeChange(r.id)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded transition-all"
            style={activeRange === r.id
              ? { background: C.gold + '33', color: C.gold, border: `1px solid ${C.gold}66` }
              : { color: C.muted, border: '1px solid transparent' }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart + axes rendered in a single SVG */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.surface2 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: H, display: 'block' }}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={LEFT} y1={t.y} x2={LEFT + CW} y2={t.y}
                stroke="currentColor" strokeOpacity="0.08"
                style={{ color: 'var(--text)' }}
                strokeWidth="0.8" strokeDasharray="3,3"
              />
              <text
                x={LEFT - 4} y={t.y + 3.5}
                textAnchor="end"
                fontSize="8"
                fill="var(--muted)"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={fill} fill={`url(#${fillId})`} />

          {/* Price line */}
          <path d={line} fill="none" stroke={lineColor} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" />

          {/* Latest-price dot */}
          <circle
            cx={toX(closes.length - 1)}
            cy={toY(closes[closes.length - 1])}
            r="3" fill={lineColor}
          />

          {/* X-axis baseline */}
          <line
            x1={LEFT} y1={TOP + CH} x2={LEFT + CW} y2={TOP + CH}
            stroke="currentColor" strokeOpacity="0.15"
            style={{ color: 'var(--text)' }}
            strokeWidth="0.8"
          />

          {/* X-axis date labels */}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={TOP + CH + 14}
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="8"
              fill="var(--muted)"
            >
              {t.label}
            </text>
          ))}

          {/* Change % badge — top right inside chart area */}
          <rect
            x={LEFT + CW - 46} y={TOP + 2}
            width="46" height="14" rx="3"
            fill={isUp ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}
          />
          <text
            x={LEFT + CW - 23} y={TOP + 12}
            textAnchor="middle" fontSize="8.5" fontWeight="700"
            fill={lineColor}
          >
            {isUp ? '▲' : '▼'} {Math.abs(changePct)}%
          </text>
        </svg>
      </div>
    </div>
  );
}

// Single expanded holding row — handles its own price fetch, chart range,
// and buy/sell sub-panels.
function HoldingRow({ h, isLast, onSell, onReload }) {
  const [expanded,   setExpanded]   = useState(false);
  const [chartRange, setChartRange] = useState('1w');
  const [panel,      setPanel]      = useState(null); // 'buy' | 'sell' | null

  // Price data
  const [prices,    setPrices]    = useState(null);  // [{date,close}]
  const [latestP,   setLatestP]   = useState(null);  // current price
  const [priceReady, setPriceReady] = useState(false);

  // Buy state
  const [buyAmount, setBuyAmount] = useState('');
  const [buyFreq,   setBuyFreq]   = useState('one-time');
  const [buying,    setBuying]    = useState(false);
  const [buyError,  setBuyError]  = useState('');

  // Sell state
  const [sellAmount,   setSellAmount]   = useState('');
  const [selling,      setSelling]      = useState(false);
  const [sellError,    setSellError]    = useState('');

  // Undo state
  const [undoBuyEntryId,  setUndoBuyEntryId]  = useState(null); // entryId of last buy
  const [undoSellIds,     setUndoSellIds]     = useState([]);   // entryIds of last sell
  const [undoModal,       setUndoModal]       = useState(null); // 'buy' | 'sell' | null
  const [undoing,         setUndoing]         = useState(false);
  const [undoError,       setUndoError]       = useState('');

  // Fetch prices when first expanded
  useEffect(() => {
    if (!expanded || priceReady) return;
    api.getChartData(h.optionId)
      .then(res => {
        const p = res.data?.prices;
        if (p && p.length >= 2) {
          setPrices(p);
          setLatestP(p[p.length - 1].close);
        }
        setPriceReady(true);
      })
      .catch(() => setPriceReady(true));
  }, [expanded, priceReady, h.optionId]);

  // Derived values using real price when available
  const latestPrice   = latestP;
  // purchasePrice = earliest price in chart data (best proxy for avg cost)
  const purchasePrice = prices ? prices[0].close : null;
  // shares = amount ÷ purchasePrice (or ÷ latestPrice as fallback)
  const refPrice      = purchasePrice || latestPrice;
  const shares        = refPrice ? +(h.totalInvested / refPrice).toFixed(4) : null;
  // est value = shares × currentPrice
  const estValue      = (shares != null && latestPrice)
    ? +(shares * latestPrice).toFixed(2)
    : +(h.totalInvested * 1.045).toFixed(2);
  const gain          = +(estValue - h.totalInvested).toFixed(2);
  const gainPct       = h.totalInvested > 0
    ? +((gain / h.totalInvested) * 100).toFixed(2)
    : 0;
  const isGain        = gain >= 0;

  // Sell helpers — convert $ amount → entries to sell (oldest first, greedy)
  const maxSellable = h.totalInvested;

  function entriesToSell(dollarAmt) {
    const result = [];
    let remaining = dollarAmt;
    for (const e of h.entryIds) {           // entryIds already in order pushed
      if (remaining <= 0) break;
      result.push(e.id);
      remaining -= e.amount;
    }
    return result;
  }

  const sellAmt         = parseFloat(sellAmount) || 0;
  const sellEntryIds    = sellAmt > 0 ? entriesToSell(sellAmt) : [];
  const selectedTotal   = h.entryIds.filter(e => sellEntryIds.includes(e.id)).reduce((s, e) => s + e.amount, 0);
  const selectedEstProceeds = (shares != null && latestPrice && selectedTotal > 0)
    ? +(selectedTotal / (refPrice || 1) * latestPrice).toFixed(2)
    : +(selectedTotal * 1.045).toFixed(2);

  async function handleBuy(e) {
    e.preventDefault();
    const amt = parseFloat(buyAmount);
    if (!amt || amt < 1) { setBuyError('Enter at least $1.'); return; }
    setBuying(true); setBuyError('');
    try {
      const res = await api.confirmChoice({
        optionId:    h.optionId,
        optionName:  h.optionName,
        amount:      amt,
        riskLevel:   h.riskLevel,
        dataSource:  'Buy more — dashboard',
        portfolioId: h.portfolioId || undefined,
      });
      setPanel('buy-done');
      setBuyAmount('');
      setUndoBuyEntryId(res.data.entry?.id || null);
      onReload();
    } catch (err) {
      setBuyError(err.response?.data?.error || 'Could not complete purchase.');
    } finally {
      setBuying(false);
    }
  }

  async function handleSell(e) {
    e.preventDefault();
    const amt = parseFloat(sellAmount);
    if (!amt || amt < 1)         { setSellError('Enter at least $1.'); return; }
    if (amt > maxSellable + 0.01){ setSellError(`Max you can sell is $${maxSellable.toFixed(2)}.`); return; }
    const ids = entriesToSell(amt);
    if (ids.length === 0)        { setSellError('Nothing to sell.'); return; }
    setSelling(true); setSellError('');
    try {
      for (const entryId of ids) {
        const res = await api.sellEntry(entryId, {
          currentPrice:  latestPrice  || undefined,
          purchasePrice: purchasePrice || undefined,
        });
        onSell(entryId, res.data.entry.soldAmount, res.data.cashBalance);
      }
      setPanel('sell-done');
      setSellAmount('');
      setUndoSellIds(ids);
    } catch (err) {
      setSellError(err.response?.data?.error || 'Could not complete sale.');
    } finally {
      setSelling(false);
    }
  }

  async function handleUndoBuy() {
    if (!undoBuyEntryId) return;
    setUndoing(true); setUndoError('');
    try {
      await api.deleteEntry(undoBuyEntryId);
      setUndoBuyEntryId(null);
      setPanel(null);
      setUndoModal(null);
      onReload();
    } catch (err) {
      setUndoError(err.response?.data?.error || 'Could not undo purchase.');
      setUndoModal(null);
    } finally {
      setUndoing(false);
    }
  }

  async function handleUndoSell() {
    if (!undoSellIds.length) return;
    setUndoing(true); setUndoError('');
    try {
      for (const id of undoSellIds) {
        const res = await api.unsellEntry(id);
        onSell(id, null, res.data.cashBalance); // null soldAmount = signal to reload
      }
      setUndoSellIds([]);
      setPanel(null);
      setUndoModal(null);
      onReload();
    } catch (err) {
      setUndoError(err.response?.data?.error || 'Could not undo sale.');
      setUndoModal(null);
    } finally {
      setUndoing(false);
    }
  }

  const priceLabel = latestPrice ? `$${latestPrice.toFixed(2)}/share` : null;

  return (
    <div style={{ borderBottom: !isLast ? `1px solid ${C.border}` : 'none' }}>
      {/* ── Summary row (always visible, click to expand) ── */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-2 transition-colors"
        onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
        onMouseOut={e  => e.currentTarget.style.background = ''}
        onClick={() => { setExpanded(v => !v); setPanel(null); }}
      >
        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{h.optionName}</p>
          <p className="text-[10px]" style={{ color: C.muted }}>
            {h.entries} purchase{h.entries !== 1 ? 's' : ''}
            {priceLabel && <span> · {priceLabel}</span>}
          </p>
        </div>

        {/* Shares */}
        <div className="text-right shrink-0" style={{ width: 52 }}>
          {shares != null
            ? <><p className="text-sm font-semibold" style={{ color: C.gold }}>{shares}</p>
                <p className="text-[10px]" style={{ color: C.muted }}>shares</p></>
            : <p className="text-[10px]" style={{ color: C.muted }}>—</p>}
        </div>

        {/* Invested */}
        <span className="text-sm font-semibold text-right shrink-0" style={{ color: C.text, width: 60 }}>
          ${h.totalInvested.toFixed(2)}
        </span>

        {/* Est. value + gain */}
        <div className="text-right shrink-0" style={{ width: 72 }}>
          <p className="text-sm font-semibold" style={{ color: isGain ? C.green : C.red }}>
            ${estValue.toFixed(2)}
          </p>
          <p className="text-[10px]" style={{ color: isGain ? C.green : C.red }}>
            {isGain ? '+' : ''}{gainPct}%
          </p>
        </div>

        {/* Risk */}
        <div className="flex justify-end shrink-0" style={{ width: 44 }}>
          <RiskBadge level={h.riskLevel} />
        </div>

        {/* Chevron */}
        <span className="text-xs shrink-0" style={{ color: C.muted }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* ── Expanded dropdown ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>

          {/* Chart */}
          <div className="pt-3">
            {!priceReady
              ? <div className="rounded-xl animate-pulse" style={{ height: 80, background: C.surface2 }} />
              : <HoldingChart
                  symbol={h.optionId}
                  activeRange={chartRange}
                  onRangeChange={setChartRange}
                  allPrices={prices}
                />
            }
          </div>

          {/* Action buttons */}
          {panel === null && (
            <div className="flex gap-2">
              <button
                onClick={() => setPanel('buy')}
                className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44` }}
              >
                💰 Buy more
              </button>
              <button
                onClick={() => { setPanel('sell'); setSellAmount(''); setSellError(''); }}
                className="flex-1 py-2 rounded-xl text-xs font-bold"
                style={{ background: C.red + '18', color: C.red, border: `1px solid ${C.red}44` }}
              >
                💸 Sell
              </button>
            </div>
          )}

          {/* ── Buy done + Undo ── */}
          {panel === 'buy-done' && (
            <div className="rounded-xl p-3 flex items-center justify-between gap-3"
              style={{ background: C.gold + '18', border: `1px solid ${C.gold}44` }}>
              <p className="text-xs font-semibold" style={{ color: C.gold }}>✓ Purchase confirmed!</p>
              <div className="flex items-center gap-2">
                {undoError && <p className="text-xs" style={{ color: C.red }}>{undoError}</p>}
                {undoBuyEntryId && (
                  <button
                    onClick={() => setUndoModal('buy')}
                    disabled={undoing}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: C.red + '18', color: C.red, border: `1px solid ${C.red}44` }}
                  >
                    ↩ Undo
                  </button>
                )}
                <button onClick={() => setPanel(null)}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                  style={{ color: C.muted, border: `1px solid ${C.border}` }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Sell done + Undo ── */}
          {panel === 'sell-done' && (
            <div className="rounded-xl p-3 flex items-center justify-between gap-3"
              style={{ background: C.red + '12', border: `1px solid ${C.red}33` }}>
              <p className="text-xs font-semibold" style={{ color: C.red }}>✓ Sale confirmed!</p>
              <div className="flex items-center gap-2">
                {undoError && <p className="text-xs" style={{ color: C.red }}>{undoError}</p>}
                {undoSellIds.length > 0 && (
                  <button
                    onClick={() => setUndoModal('sell')}
                    disabled={undoing}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}
                  >
                    ↩ Undo
                  </button>
                )}
                <button onClick={() => setPanel(null)}
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                  style={{ color: C.muted, border: `1px solid ${C.border}` }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Buy panel ── */}
          {panel === 'buy' && (
            <form onSubmit={handleBuy} className="space-y-3 rounded-xl p-3"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.gold }}>
                Buy more · {h.optionName}
              </p>

              <div>
                <label className="block text-xs mb-1" style={{ color: C.muted }}>Amount ($)</label>
                <input
                  type="number" min="1" step="any"
                  value={buyAmount}
                  onChange={e => setBuyAmount(e.target.value)}
                  placeholder="e.g. 100"
                  required
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: `1px solid ${C.border}`, color: C.text }}
                />
                {buyAmount && parseFloat(buyAmount) >= 1 && latestPrice && (
                  <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                    ≈ {(parseFloat(buyAmount) / latestPrice).toFixed(4)} shares at ${latestPrice.toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: C.muted }}>Frequency</label>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: 'one-time', label: 'One Time' },
                    { id: 'daily',    label: 'Daily'    },
                    { id: 'weekly',   label: 'Weekly'   },
                    { id: 'monthly',  label: 'Monthly'  },
                    { id: 'yearly',   label: 'Yearly'   },
                  ].map(f => (
                    <button key={f.id} type="button"
                      onClick={() => setBuyFreq(f.id)}
                      className="text-[10px] py-1.5 rounded-lg font-semibold text-center"
                      style={buyFreq === f.id
                        ? { background: C.gold, color: 'var(--bg)' }
                        : { background: 'var(--surface)', color: C.muted, border: `1px solid ${C.border}` }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {buyError && <p className="text-xs" style={{ color: C.red }}>{buyError}</p>}

              <div className="flex gap-2">
                <button type="submit" disabled={buying}
                  className="flex-1 py-2 rounded-xl font-bold text-xs disabled:opacity-50"
                  style={{ background: C.goldBtn, color: 'var(--bg)' }}>
                  {buying ? 'Buying…' : 'Confirm purchase'}
                </button>
                <button type="button" onClick={() => setPanel(null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ color: C.muted, border: `1px solid ${C.border}` }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ── Sell panel ── */}
          {panel === 'sell' && (
            <form onSubmit={handleSell} className="space-y-3 rounded-xl p-3"
              style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.red }}>
                Sell · {h.optionName}
              </p>

              <div>
                <label className="block text-xs mb-1" style={{ color: C.muted }}>
                  Amount to sell ($) · max ${maxSellable.toFixed(2)}
                </label>
                <input
                  type="number" min="1" step="any" max={maxSellable}
                  value={sellAmount}
                  onChange={e => { setSellAmount(e.target.value); setSellError(''); }}
                  placeholder={`Up to $${maxSellable.toFixed(2)}`}
                  required
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: `1px solid ${C.border}`, color: C.text }}
                />
                {/* Quick-fill buttons */}
                <div className="flex gap-1.5 mt-1.5">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button key={pct} type="button"
                      onClick={() => { setSellAmount((maxSellable * pct).toFixed(2)); setSellError(''); }}
                      className="flex-1 text-[10px] py-1 rounded-lg font-semibold"
                      style={{ background: 'var(--surface)', color: C.muted, border: `1px solid ${C.border}` }}>
                      {pct === 1 ? 'All' : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {sellAmt >= 1 && sellAmt <= maxSellable + 0.01 && (
                <div className="rounded-xl px-3 py-2"
                  style={{ background: C.red + '12', border: `1px solid ${C.red}33` }}>
                  <p className="text-xs font-semibold" style={{ color: C.red }}>
                    Selling ~${selectedTotal.toFixed(2)} · est. proceeds ${selectedEstProceeds.toFixed(2)}
                    {latestPrice && <span style={{ color: C.muted, fontWeight: 400 }}> at ${latestPrice.toFixed(2)}/share</span>}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                    Covers {sellEntryIds.length} purchase{sellEntryIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {sellError && <p className="text-xs" style={{ color: C.red }}>{sellError}</p>}

              <div className="flex gap-2">
                <button type="submit"
                  disabled={selling || sellAmt < 1}
                  className="flex-1 py-2 rounded-xl font-bold text-xs disabled:opacity-50"
                  style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}>
                  {selling ? 'Selling…' : 'Confirm sale'}
                </button>
                <button type="button" onClick={() => { setPanel(null); setSellAmount(''); setSellError(''); }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ color: C.muted, border: `1px solid ${C.border}` }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Undo password modal ── */}
      {undoModal === 'buy' && (
        <UndoConfirmModal
          title={`Undo purchase of ${h.optionName}`}
          message={`This will permanently remove your most recent purchase entry. Enter your password to confirm.`}
          onConfirm={handleUndoBuy}
          onCancel={() => setUndoModal(null)}
        />
      )}
      {undoModal === 'sell' && (
        <UndoConfirmModal
          title={`Undo sale of ${h.optionName}`}
          message={`This will restore the sold entries back to active and reverse the cash balance. Enter your password to confirm.`}
          onConfirm={handleUndoSell}
          onCancel={() => setUndoModal(null)}
        />
      )}
    </div>
  );
}


// ── Portfolio overview grid ───────────────────────────────────────────────────
const RISK_COLORS = {
  conservative: { color: 'var(--low)',    bg: 'var(--bg-risk-low)',    label: 'Conservative', emoji: '🛡️' },
  balanced:     { color: 'var(--medium)', bg: 'var(--bg-risk-medium)', label: 'Balanced',     emoji: '⚖️' },
  aggressive:   { color: 'var(--high)',   bg: 'var(--bg-risk-high)',   label: 'Aggressive',   emoji: '🚀' },
};

function holdTermLabel(months) {
  if (months <= 3)  return { label: 'Short term',  sub: `${months} mo` };
  if (months <= 11) return { label: 'Medium term', sub: `${months} mo` };
  const y = Math.round(months / 12);
  return { label: 'Long term', sub: `${y} yr${y > 1 ? 's' : ''}` };
}

function PortfolioGrid({ portfolios, history, activePortfolio, onSelect, onNew }) {
  // Build per-portfolio stats from history
  const statsById = React.useMemo(() => {
    const map = {};
    for (const e of history) {
      const pid = e.portfolioId || '';
      if (!map[pid]) map[pid] = { invested: 0, positions: new Set() };
      if (!e.sold) {
        map[pid].invested  += e.amount || 0;
        map[pid].positions.add(e.optionId);
      }
    }
    // Convert sets to counts
    Object.values(map).forEach((s) => { s.positions = s.positions.size; });
    return map;
  }, [history]);

  const allCards = [
    {
      id: '',
      name: 'Original Portfolio',
      riskProfile: null,
      holdPeriodMonths: null,
      isOriginal: true,
    },
    ...portfolios.map((p) => ({ ...p, isOriginal: false })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          🗂️ Your portfolios ({allCards.length})
        </p>
        <button
          onClick={onNew}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold"
          style={{ background: C.goldBtn, color: 'var(--bg)' }}
        >
          + New
        </button>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
        {allCards.map((p) => {
          const stats  = statsById[p.id] || { invested: 0, positions: 0 };
          const risk   = p.riskProfile ? RISK_COLORS[p.riskProfile] : null;
          const term   = p.holdPeriodMonths ? holdTermLabel(p.holdPeriodMonths) : null;
          const active = activePortfolio === p.id;

          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="text-left rounded-2xl p-3 transition-all"
              style={{
                background:  active ? 'var(--gold-pale)' : C.surface2,
                border:      `2px solid ${active ? C.gold : C.border}`,
              }}
            >
              {/* Portfolio name */}
              <p className="text-xs font-bold leading-snug mb-2 truncate" style={{ color: active ? C.gold : C.text }}>
                {p.isOriginal ? '🪙 ' : '📁 '}{p.name}
              </p>

              {/* Risk badge */}
              {risk && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
                  style={{ background: risk.bg, color: risk.color }}
                >
                  {risk.emoji} {risk.label}
                </span>
              )}

              {/* Hold-period term */}
              {term && (
                <p className="text-[10px] mb-2" style={{ color: C.muted }}>
                  ⏱ {term.label} · {term.sub}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center justify-between mt-auto">
                <div>
                  <p className="text-[10px]" style={{ color: C.muted }}>Invested</p>
                  <p className="text-xs font-bold" style={{ color: C.text }}>
                    ${stats.invested.toFixed(0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]" style={{ color: C.muted }}>Positions</p>
                  <p className="text-xs font-bold" style={{ color: C.text }}>
                    {stats.positions}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function HoldingsTable({ holdings, portfolios, onSell, onReload }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${C.border}` }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          📊 What you own ({holdings.length} position{holdings.length !== 1 ? 's' : ''})
        </p>
        <p className="text-[10px]" style={{ color: C.muted }}>Tap a row to expand</p>
      </div>

      {/* Column headers */}
      <div className="flex px-4 py-1.5 items-center gap-2"
        style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Stock</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: C.muted, width: 52 }}>Shares</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: C.muted, width: 60 }}>Invested</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: C.muted, width: 72 }}>Est. value</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: C.muted, width: 44 }}>Risk</span>
        <span style={{ width: 12 }} />
      </div>

      {holdings.map((h, i) => (
        <HoldingRow
          key={h.optionId}
          h={h}
          isLast={i === holdings.length - 1}
          onSell={onSell}
          onReload={onReload}
        />
      ))}

      <div className="px-4 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="text-[10px]" style={{ color: C.muted }}>
          Shares &amp; value based on live Alpha Vantage prices where available · illustrative fallback (+4.5%) when offline
        </p>
      </div>
    </div>
  );
}

function EmptyState({ navigate }) {
  return (
    <div className="card text-center py-12 space-y-4">
      <div className="text-5xl">🪙</div>
      <h2 className="text-lg font-bold" style={{ color: C.text }}>No history yet</h2>
      <p className="text-sm max-w-xs mx-auto" style={{ color: C.muted }}>
        Make your first investing decision and confirm it to see your portfolio here.
      </p>
      <button
        onClick={() => navigate('/start')}
        className="px-6 py-2.5 rounded-xl font-semibold text-sm"
        style={{ background: C.goldBtn, color: 'var(--bg)' }}
      >
        Start investing →
      </button>
    </div>
  );
}

function SummaryCard({ summary, history, rangeLabel }) {
  const { weeks, totalInvested, currentValue, changePercent } = summary;
  const gain = changePercent >= 0;

  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.muted }}>
        ⑥ Progress · {rangeLabel} · {weeks} entr{weeks !== 1 ? 'ies' : 'y'}
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs" style={{ color: C.muted }}>Total put in</p>
          <p className="text-2xl font-bold" style={{ color: C.text }}>${totalInvested.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: C.muted }}>Value today (est.)</p>
          <p className="text-2xl font-bold" style={{ color: C.text }}>
            ${currentValue.toFixed(2)}{' '}
            <span className="text-sm font-semibold" style={{ color: gain ? C.green : C.red }}>
              {gain ? '+' : ''}{changePercent}%
            </span>
          </p>
        </div>
      </div>
      <PortfolioGrowthChart history={history} currentValue={currentValue} />
      <p className="text-xs mt-2" style={{ color: C.muted }}>
        Prices: illustrative example · updated today
      </p>
    </div>
  );
}

function PortfolioGrowthChart({ history, currentValue }) {
  if (!history || history.length === 0) return null;
  const reversed = [...history].reverse();
  const points   = [];
  let running = 0;
  for (const entry of reversed) { running += entry.amount || 0; points.push(running); }
  const scale    = currentValue / running;
  const values   = points.map((v) => v * scale);
  const allValues = [0, ...values];
  const W = 400, H = 56, PAD_X = 2, PAD_Y = 4;
  const maxV = Math.max(...allValues, 1);
  const toX  = (i) => PAD_X + (i / (allValues.length - 1)) * (W - PAD_X * 2);
  const toY  = (v) => PAD_Y + (1 - v / maxV) * (H - PAD_Y * 2);
  const linePoints = allValues.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const polyline   = `M ${linePoints.replace(/ /g, ' L ')}`;
  const fillPath   = `${polyline} L ${toX(allValues.length - 1)},${H} L ${toX(0)},${H} Z`;
  return (
    <div className="rounded-xl overflow-hidden" style={{ height: 56, background: C.surface2 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="portfolio-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.gold} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#portfolio-grad)" />
        <path d={polyline} fill="none" stroke={C.gold} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={toX(allValues.length - 1)} cy={toY(allValues[allValues.length - 1])} r="3" fill={C.gold} />
      </svg>
    </div>
  );
}

function QuickStatsBar({ summary }) {
  const { totalGain, positions, biggest, totalSold } = summary;

  const stats = [
    {
      label: 'Total gain',
      value: `+$${totalGain.toFixed(2)}`,
      color: C.green,
    },
    {
      label: 'Positions',
      value: positions,
      color: C.text,
    },
    {
      label: 'Top holding',
      value: biggest ? biggest.name.split(' ')[0] : '—',
      color: C.gold,
    },
  ];

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
      {stats.map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: C.surface2, border: `1px solid ${C.border}` }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
            {label}
          </p>
          <p className="text-sm font-black leading-none" style={{ color }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── History list ───────────────────────────────────────────────────────────────
function HistoryList({ history, portfolios, onSell, onReload }) {
  const [expanded, setExpanded]     = useState(null);
  const [selling, setSelling]       = useState(null);   // entry id currently being sold
  const [sellStatus, setSellStatus] = useState({});     // { [id]: 'selling'|'done'|'error' }
  const [moving, setMoving]         = useState(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveStatus, setMoveStatus] = useState({});

  // Undo state
  const [undoModal, setUndoModal]   = useState(null);  // { type: 'buy'|'sell', entry }
  const [undoing,   setUndoing]     = useState(false);
  const [undoError, setUndoError]   = useState({});    // { [id]: string }

  async function handleSell(entry) {
    setSelling(entry.id);
    setSellStatus((s) => ({ ...s, [entry.id]: 'selling' }));
    try {
      const res = await api.sellEntry(entry.id);
      setSellStatus((s) => ({ ...s, [entry.id]: 'done' }));
      onSell(entry.id, res.data.entry.soldAmount, res.data.cashBalance);
    } catch (err) {
      const msg = err.response?.data?.error || 'error';
      setSellStatus((s) => ({ ...s, [entry.id]: msg === 'Already sold.' ? 'already' : 'error' }));
    } finally {
      setSelling(null);
    }
  }

  async function handleUndoBuy(entry) {
    setUndoing(true); setUndoError({});
    try {
      await api.deleteEntry(entry.id);
      setUndoModal(null);
      onReload();
    } catch (err) {
      setUndoError({ [entry.id]: err.response?.data?.error || 'Could not undo.' });
      setUndoModal(null);
    } finally {
      setUndoing(false);
    }
  }

  async function handleUndoSell(entry) {
    setUndoing(true); setUndoError({});
    try {
      const res = await api.unsellEntry(entry.id);
      onSell(entry.id, null, res.data.cashBalance);
      setUndoModal(null);
      onReload();
    } catch (err) {
      setUndoError({ [entry.id]: err.response?.data?.error || 'Could not undo.' });
      setUndoModal(null);
    } finally {
      setUndoing(false);
    }
  }

  async function moveToPortfolio(entry) {
    if (!moveTarget) return;
    setMoveStatus((s) => ({ ...s, [entry.id]: 'saving' }));
    try {
      await api.confirmChoice({
        optionId:   entry.optionId,
        optionName: entry.optionName,
        amount:     entry.amount,
        riskLevel:  entry.riskLevel,
        whyItFits:  entry.whyItFits || undefined,
        dataSource: `Moved to portfolio: ${portfolios.find(p => p.id === moveTarget)?.name || moveTarget}`,
      });
      setMoveStatus((s) => ({ ...s, [entry.id]: 'done' }));
      setMoving(null);
      setTimeout(() => {
        setMoveStatus((s) => { const n = { ...s }; delete n[entry.id]; return n; });
        onReload();
      }, 1200);
    } catch {
      setMoveStatus((s) => ({ ...s, [entry.id]: 'error' }));
    }
  }

  if (history.length === 0) {
    return (
      <div className="rounded-xl text-center py-8" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-sm" style={{ color: C.muted }}>No investments in this view.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        ⑧ History ({history.length})
      </p>
      {history.map((entry) => {
        const status     = sellStatus[entry.id];
        const moveState  = moveStatus[entry.id];
        const isSold     = entry.sold;

        return (
          <div key={entry.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Main row */}
            <button
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="w-full text-left px-4 py-3 transition-colors"
              onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseOut={e  => e.currentTarget.style.background = ''}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: isSold ? C.muted : C.text }}>
                      {entry.optionName}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: C.muted }}>
                    {entry.date} · ${entry.amount}
                    {isSold && entry.soldAmount != null && (
                      <span style={{ color: C.green }}> → sold ${entry.soldAmount.toFixed(2)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <RiskBadge level={entry.riskLevel} />
                  <span
                    className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                    style={isSold
                      ? { background: C.red + '22', color: C.red }
                      : { background: 'rgba(74,222,128,0.15)', color: C.green }
                    }
                    title={isSold ? 'Sold' : 'Confirmed'}
                  >
                    {isSold ? '✕' : '✓'}
                  </span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    {expanded === entry.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === entry.id && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="pt-3">
                  {entry.optionId && <StockChart symbol={entry.optionId} height={64} compact />}
                </div>

                {entry.whyItFits && (
                  <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--gold-pale)' }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: C.gold }}>Why it fit</p>
                    <p className="text-xs leading-relaxed" style={{ color: C.text }}>{entry.whyItFits}</p>
                    {entry.dataSource && (
                      <p className="text-xs mt-1" style={{ color: C.muted }}>Source: {entry.dataSource}</p>
                    )}
                  </div>
                )}

                {/* ── Sell button ─────────────────────────────────────────── */}
                {!isSold && (
                  <div className="flex flex-col gap-2">
                    {status === 'done' ? (
                      <p className="text-xs font-semibold" style={{ color: C.green }}>
                        ✓ Sold — cash added to your balance.
                      </p>
                    ) : status === 'already' ? (
                      <p className="text-xs" style={{ color: C.muted }}>Already sold.</p>
                    ) : status === 'error' ? (
                      <p className="text-xs" style={{ color: C.red }}>Sale failed. Try again.</p>
                    ) : (
                      <button
                        onClick={() => handleSell(entry)}
                        disabled={selling === entry.id}
                        className="px-4 py-2 rounded-xl text-xs font-bold transition-opacity disabled:opacity-50"
                        style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}
                      >
                        {selling === entry.id ? 'Selling…' : `💸 Sell at est. $${(entry.amount * 1.045).toFixed(2)}`}
                      </button>
                    )}
                    {/* Undo buy */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUndoModal({ type: 'buy', entry })}
                        disabled={undoing}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                        style={{ color: C.muted, border: `1px solid ${C.border}` }}
                      >
                        ↩ Undo purchase
                      </button>
                      {undoError[entry.id] && (
                        <p className="text-xs" style={{ color: C.red }}>{undoError[entry.id]}</p>
                      )}
                    </div>
                  </div>
                )}

                {isSold && entry.soldAmount != null && (
                  <div className="rounded-xl px-3 py-2.5"
                    style={{ background: C.green + '11', border: `1px solid ${C.green}33` }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: C.green }}>
                          Sold for ${entry.soldAmount.toFixed(2)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                          Cash added to your balance on {entry.soldAt ? entry.soldAt.split('T')[0] : 'unknown date'}.
                        </p>
                      </div>
                      <button
                        onClick={() => setUndoModal({ type: 'sell', entry })}
                        disabled={undoing}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold shrink-0"
                        style={{ color: C.muted, border: `1px solid ${C.border}` }}
                      >
                        ↩ Undo sale
                      </button>
                    </div>
                    {undoError[entry.id] && (
                      <p className="text-xs mt-1" style={{ color: C.red }}>{undoError[entry.id]}</p>
                    )}
                  </div>
                )}

                {/* ── Move to portfolio ───────────────────────────────────── */}
                {!isSold && portfolios.length > 0 && (
                  <div>
                    {moving === entry.id ? (
                      <div className="flex gap-2 items-center">
                        <select
                          value={moveTarget}
                          onChange={(e) => setMoveTarget(e.target.value)}
                          className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
                        >
                          <option value="">— choose portfolio —</option>
                          {portfolios.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => moveToPortfolio(entry)}
                          disabled={!moveTarget || moveState === 'saving'}
                          className="px-3 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            background: moveTarget ? C.goldBtn : C.surface2,
                            color:      moveTarget ? 'var(--bg)' : C.muted,
                          }}
                        >
                          {moveState === 'saving' ? '…' : moveState === 'done' ? '✓' : 'Move'}
                        </button>
                        <button
                          onClick={() => { setMoving(null); setMoveTarget(''); }}
                          className="text-xs px-2 py-2 rounded-xl"
                          style={{ color: C.muted }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMoving(entry.id); setMoveTarget(''); }}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ border: `1px solid ${C.border}`, color: C.muted }}
                      >
                        📁 Move to portfolio…
                      </button>
                    )}
                    {moveState === 'done' && (
                      <p className="text-xs mt-1" style={{ color: C.green }}>Moved successfully.</p>
                    )}
                    {moveState === 'error' && (
                      <p className="text-xs mt-1" style={{ color: C.red }}>Failed to move. Try again.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Undo password modal */}
      {undoModal?.type === 'buy' && (
        <UndoConfirmModal
          title={`Undo purchase of ${undoModal.entry.optionName}`}
          message={`This will permanently remove this purchase entry ($${undoModal.entry.amount}). Enter your password to confirm.`}
          onConfirm={() => handleUndoBuy(undoModal.entry)}
          onCancel={() => setUndoModal(null)}
        />
      )}
      {undoModal?.type === 'sell' && (
        <UndoConfirmModal
          title={`Undo sale of ${undoModal.entry.optionName}`}
          message={`This will restore the entry to active and reverse $${undoModal.entry.soldAmount?.toFixed(2)} from your cash balance. Enter your password to confirm.`}
          onConfirm={() => handleUndoSell(undoModal.entry)}
          onCancel={() => setUndoModal(null)}
        />
      )}
    </div>
  );
}
