/**
 * SwipeCard.js — Invest options card deck.
 *
 * Layout matches the reference drawing:
 *  TOP ROW:   [Image 1 — product photo]  |  [Company name + Logo, Gain|Risk, Why fits, Definitions]
 *  BOTTOM ROW:[Graph + time-range tabs + News bubbles + More news]  |  [Image 2]
 *
 * Swipe left/right OR arrow buttons to navigate between cards.
 * Confirm button lives at the bottom of the info panel.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import RiskBadge from './RiskBadge';
import GlossaryTerm from './GlossaryTerm';

const C = {
  gold:    '#f0b429',
  goldBtn: 'linear-gradient(135deg,#c98a00,#f0b429)',
  text:    '#f0ede6',
  muted:   '#7a9a7a',
  surface: '#152215',
  surface2:'#1e311e',
  border:  '#2b422b',
  bg:      '#0d1a0d',
  green:   '#4ade80',
  red:     '#f87171',
};

const RISK_COLORS = { low: '#4ade80', medium: '#fbbf24', high: '#f87171' };

// ── Time-range definitions ────────────────────────────────────────────────────
// points: number of data points to generate (defaults to days).
// For 24H we generate 78 × 5-min intraday bars instead of 1 daily close.
const TIME_RANGES = [
  { id: '1d',  label: '24H', days: 1,   points: 78  },
  { id: '1w',  label: '1W',  days: 7,   points: 7   },
  { id: '1m',  label: '1M',  days: 30,  points: 30  },
  { id: '6m',  label: '6M',  days: 182, points: 182 },
  { id: '1y',  label: '1Y',  days: 365, points: 365 },
  { id: 'all', label: 'All', days: 730, points: 730 },
];

/**
 * Generate realistic-looking seeded price data for a ticker.
 * Uses the ticker string as a seed so each company has consistent, unique data.
 *
 * @param {string} ticker
 * @param {number} days        - time horizon in calendar days (drives drift scaling)
 * @param {number} returnLow
 * @param {number} returnHigh
 * @param {number} points      - number of data points to emit (defaults to days)
 */
function generatePriceData(ticker, days, returnLow, returnHigh, points) {
  const n = Math.max(points || days, 2); // always at least 2 points so the chart renders

  // Simple seeded PRNG
  let seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  }

  const midReturn = (returnLow + returnHigh) / 2;
  const annualDrift = Math.max(midReturn, 2) / 100;        // per-year drift
  // Scale drift and vol per interval: 252 trading-day equivalents per year,
  // n intervals span `days` calendar days → intervals/year = 252 * n / days.
  const tradingDays = Math.max(days, 1);
  const intervalsPerYear = 252 * n / tradingDays;
  const intervalDrift = annualDrift / intervalsPerYear;
  const annualVol   = Math.max(Math.abs(returnHigh) * 0.4, 8) / 100;
  const intervalVol = annualVol / Math.sqrt(intervalsPerYear);

  // Base price between $50–$500 seeded by ticker
  const basePrice = 50 + (rand() * 450);
  const prices = [];

  let price = basePrice;
  for (let i = 0; i < n; i++) {
    const change = price * (intervalDrift + intervalVol * (rand() * 2 - 1) * 2.5);
    price = Math.max(price + change, basePrice * 0.3);
    prices.push(parseFloat(price.toFixed(2)));
  }
  return prices;
}

// ── Sparkline chart with time-range tabs ─────────────────────────────────────
function InlineChart({ option }) {
  const [activeRange, setActiveRange] = useState('1m');

  const range    = TIME_RANGES.find((r) => r.id === activeRange);
  const prices   = useMemo(
    () => generatePriceData(option.ticker, range.days, option.returnRangeLow, option.returnRangeHigh, range.points),
    [option.ticker, option.returnRangeLow, option.returnRangeHigh, range.days, range.points]
  );

  // Build SVG sparkline
  const W = 400, H = 80, PAD_X = 2, PAD_Y = 6;
  const minV = Math.min(...prices);
  const maxV = Math.max(...prices);
  const rng  = maxV - minV || 1;
  const toX  = (i) => PAD_X + (i / (prices.length - 1)) * (W - PAD_X * 2);
  const toY  = (v) => PAD_Y + (1 - (v - minV) / rng) * (H - PAD_Y * 2);
  const pts   = prices.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const line  = `M ${pts.replace(/ /g, ' L ')}`;
  const fill  = `${line} L ${toX(prices.length - 1)},${H} L ${toX(0)},${H} Z`;

  const isUp    = prices[prices.length - 1] >= prices[0];
  const changePct = (((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(1);
  const lineColor = isUp ? C.green : C.red;
  const fillId  = `grad-${option.ticker}-${activeRange}`;
  const color   = option.color || C.gold;

  return (
    <div>
      {/* Time-range pills */}
      <div className="flex gap-1 mb-2">
        {TIME_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRange(r.id)}
            className="text-[10px] font-semibold px-2 py-0.5 rounded transition-all"
            style={
              activeRange === r.id
                ? { background: color + '33', color, border: `1px solid ${color}66` }
                : { color: C.muted, border: '1px solid transparent' }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <div className="rounded-xl overflow-hidden relative" style={{ height: H, background: C.surface2 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${fillId})`} />
          <path d={line} fill="none" stroke={lineColor} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={toX(prices.length - 1)} cy={toY(prices[prices.length - 1])} r="3" fill={lineColor} />
        </svg>

        {/* % badge */}
        <div className="absolute top-1.5 right-2 pointer-events-none">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={
              isUp
                ? { background: 'rgba(74,222,128,0.15)', color: C.green }
                : { background: 'rgba(248,113,113,0.15)', color: C.red }
            }
          >
            {isUp ? '▲' : '▼'} {Math.abs(changePct)}%
          </span>
        </div>

        {/* Min / Max labels */}
        <div className="absolute bottom-1 left-2 right-2 flex justify-between pointer-events-none">
          <span className="text-[9px]" style={{ color: C.muted }}>${minV.toFixed(0)}</span>
          <span className="text-[9px]" style={{ color: C.muted }}>${maxV.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

// ── News bubbles list ─────────────────────────────────────────────────────────
function NewsBubbles({ links, color }) {
  const [showAll, setShowAll] = useState(false);
  if (!links || links.length === 0) return null;

  const visible = showAll ? links : links.slice(0, 3);

  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>
        📰 Latest news
      </p>
      <div className="space-y-1.5">
        {visible.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              textDecoration: 'none',
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = color}
            onMouseOut={e => e.currentTarget.style.borderColor = C.border}
          >
            <span className="text-[10px] font-medium flex-1 truncate" style={{ color: C.text }}>
              {link.label}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: C.muted }}>→</span>
          </a>
        ))}
      </div>
      {links.length > 3 && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-1.5 text-[10px] font-semibold hover:underline"
          style={{ color }}
        >
          {showAll ? 'Show less' : `More news (${links.length - 3} more)`}
        </button>
      )}
    </div>
  );
}

// ── Primary image with emoji fallback ────────────────────────────────────────
function CardImage({ src, alt, emoji, style, className }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center ${className || ''}`}
        style={{ ...style, fontSize: 56 }}
      >
        {emoji || '📈'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

// ── Image 2: always-rendered branded stats panel ─────────────────────────────
// Rendered entirely in-app using the investment's own data and brand color.
// No external image dependency — guaranteed relevant and never broken.
function BrandedImage2({ option }) {
  const color   = option.color || '#f0b429';
  const gain    = option.returnRangeHigh >= 0;
  const riskColor = RISK_COLORS[option.riskLevel] || color;

  // Mini sparkline using the same seeded generator — 30-day preview
  const previewPrices = useMemo(
    () => generatePriceData(option.ticker, 30, option.returnRangeLow, option.returnRangeHigh),
    [option.ticker, option.returnRangeLow, option.returnRangeHigh]
  );
  const W = 200, H = 56, PX = 2, PY = 4;
  const minV = Math.min(...previewPrices);
  const maxV = Math.max(...previewPrices);
  const rng  = maxV - minV || 1;
  const toX  = (i) => PX + (i / (previewPrices.length - 1)) * (W - PX * 2);
  const toY  = (v) => PY + (1 - (v - minV) / rng) * (H - PY * 2);
  const pts  = previewPrices.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const line = `M ${pts.replace(/ /g, ' L ')}`;
  const fill = `${line} L ${toX(previewPrices.length - 1)},${H} L ${toX(0)},${H} Z`;
  const lineColor = previewPrices[previewPrices.length - 1] >= previewPrices[0] ? '#4ade80' : '#f87171';
  const changePct = (((previewPrices[previewPrices.length - 1] - previewPrices[0]) / previewPrices[0]) * 100).toFixed(1);

  return (
    <div
      className="w-full h-full flex flex-col justify-between px-3 py-3"
      style={{
        minHeight: 200,
        background: `linear-gradient(160deg, ${color}1a 0%, ${color}06 100%)`,
        borderLeft: `1px solid ${color}33`,
      }}
    >
      {/* Top: emoji + ticker */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 32 }}>{option.emoji}</span>
        <span
          className="text-xs font-black tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: color + '25', color, border: `1px solid ${color}55` }}
        >
          {option.ticker}
        </span>
      </div>

      {/* Middle: 30-day mini chart */}
      <div className="rounded-lg overflow-hidden" style={{ height: 56, background: 'rgba(0,0,0,0.25)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id={`brand2-${option.ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={lineColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#brand2-${option.ticker})`} />
          <path d={line} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={toX(previewPrices.length - 1)} cy={toY(previewPrices[previewPrices.length - 1])} r="3" fill={lineColor} />
        </svg>
      </div>

      {/* Bottom: return range + risk badge */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] uppercase tracking-wide" style={{ color: '#7a9a7a' }}>30d trend</p>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={
              lineColor === '#4ade80'
                ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80' }
                : { background: 'rgba(248,113,113,0.15)', color: '#f87171' }
            }
          >
            {lineColor === '#4ade80' ? '▲' : '▼'} {Math.abs(changePct)}%
          </span>
        </div>

        <div>
          <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: '#7a9a7a' }}>Hist. return / yr</p>
          <p className="text-sm font-black leading-tight" style={{ color: gain ? '#4ade80' : '#f87171' }}>
            {option.returnRangeLow > 0 ? '+' : ''}{option.returnRangeLow}%
            {' – '}
            {option.returnRangeHigh > 0 ? '+' : ''}{option.returnRangeHigh}%
          </p>
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: riskColor }} />
          <span className="text-[9px]" style={{ color: '#7a9a7a' }}>{option.stabilityLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ── Portfolio multi-select checkbox dropdown ──────────────────────────────────
// Shows ALL portfolios with checkboxes. The initially-chosen one starts ticked.
// User can tick/untick any others to tag this investment to multiple portfolios.
function PortfolioDropdown({ portfolios, checkedIds, onToggle, color }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  React.useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!portfolios || portfolios.length === 0) return null;

  const checkedCount = checkedIds.length;
  const triggerLabel = checkedCount === 0
    ? '— none —'
    : checkedCount === 1
      ? portfolios.find(p => p.id === checkedIds[0])?.name || '1 portfolio'
      : `${checkedCount} portfolios`;

  return (
    <div ref={ref}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>
        📁 Add to portfolio <span className="normal-case font-normal">(optional)</span>
      </p>

      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
        style={{
          background: C.surface2,
          border: `1px solid ${open ? color : C.border}`,
          color: checkedCount > 0 ? C.text : C.muted,
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {checkedCount > 0 && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          )}
          {triggerLabel}
        </span>
        <span className="ml-2 shrink-0 text-xs" style={{ color: C.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown — all portfolios with checkboxes */}
      {open && (
        <div
          className="rounded-xl overflow-hidden mt-1"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
        >
          {portfolios.map((p, i) => {
            const checked = checkedIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left"
                style={{
                  borderBottom: i < portfolios.length - 1 ? `1px solid ${C.border}` : 'none',
                  color: C.text,
                }}
                onMouseOver={e => e.currentTarget.style.background = '#1a2d1a'}
                onMouseOut={e => e.currentTarget.style.background = ''}
              >
                {/* Checkbox */}
                <span
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all"
                  style={{
                    border: `2px solid ${checked ? color : C.border}`,
                    background: checked ? color : 'transparent',
                  }}
                >
                  {checked && (
                    <span className="text-[9px] font-black leading-none" style={{ color: '#0d1a0d' }}>✓</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{p.name}</p>
                  <p className="text-xs capitalize" style={{ color: C.muted }}>{p.riskProfile} risk</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Compact invest widget (matches screenshot style) ─────────────────────────
const FREQ_OPTIONS = [
  { id: 'one-time', label: 'One-time', icon: '⚡' },
  { id: 'daily',    label: 'Daily',    icon: '📆' },
  { id: 'weekly',   label: 'Weekly',   icon: '📅' },
  { id: 'monthly',  label: 'Monthly',  icon: '🗓️' },
  { id: 'yearly',   label: 'Yearly',   icon: '📊' },
];

function InvestWidget({ weeklyAmount, initialFrequency, color }) {
  const [freq, setFreq] = useState(initialFrequency || 'weekly');

  // The amount never changes — only the schedule label does.
  // We display exactly what the user set, regardless of frequency.
  const amount = parseFloat(weeklyAmount) || 0;
  const displayAmount = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);

  const freqLabel = {
    'one-time': 'one-time payment',
    'daily':    'per day',
    'weekly':   'per week',
    'monthly':  'per month',
    'yearly':   'per year',
  }[freq] || 'per week';

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
      {/* Amount row — always shows the user's chosen amount */}
      <div className="px-4 pt-3 pb-2.5" style={{ background: C.surface2 }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
          Amount to invest
        </p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-black" style={{ color }}>
            <span className="text-base mr-0.5" style={{ color: C.muted }}>$</span>
            {displayAmount}
          </p>
          <span className="text-xs" style={{ color: C.muted }}>{freqLabel}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.border }} />

      {/* How often */}
      <div className="px-3 py-3" style={{ background: C.surface }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: C.muted }}>
          How often?
        </p>
        <div className="flex gap-1.5">
          {FREQ_OPTIONS.map((f) => {
            const active = freq === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFreq(f.id)}
                className="flex-1 flex flex-col items-center py-2 rounded-xl transition-all"
                style={{
                  background: active ? 'transparent' : C.surface2,
                  border: `1.5px solid ${active ? color : C.border}`,
                }}
              >
                <span className="text-base leading-none mb-0.5">{f.icon}</span>
                <span
                  className="text-[9px] font-semibold leading-none"
                  style={{ color: active ? color : C.muted }}
                >
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Single card ───────────────────────────────────────────────────────────────
function Card({ option, rank, total, weeklyAmount, holdPeriodMonths, frequency, onConfirm, confirming,
                portfolios, selectedPortfolioId,
                swipeOffset, isDragging }) {

  const color   = option.color || C.gold;

  // Multi-select portfolio state — always starts empty; the user explicitly
  // picks where to log the investment in the dropdown (optional).
  const [checkedPortfolioIds, setCheckedPortfolioIds] = useState([]);
  function togglePortfolio(id) {
    setCheckedPortfolioIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // Pass both the checked IDs (for allocation) and their names (for the note).
  function handleConfirm() {
    onConfirm(option, checkedPortfolioIds);
  }
  const rotate  = isDragging ? swipeOffset * 0.03 : 0;
  const opacity = isDragging ? Math.max(0.6, 1 - Math.abs(swipeOffset) / 400) : 1;
  const hintLeft  = swipeOffset < -40;
  const hintRight = swipeOffset > 40;

  const gain = option.returnRangeHigh >= 0;

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        background:  C.surface,
        border:      `1px solid ${C.border}`,
        transform:   `translateX(${swipeOffset}px) rotate(${rotate}deg)`,
        opacity,
        transition:  isDragging ? 'none' : 'transform 0.35s cubic-bezier(.22,.68,0,1.2), opacity 0.2s',
        cursor:      isDragging ? 'grabbing' : 'grab',
        userSelect:  'none',
        position:    'relative',
      }}
    >
      {/* Swipe hint overlays */}
      {hintLeft && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl pointer-events-none"
          style={{ background: 'rgba(248,113,113,0.18)' }}>
          <span className="text-5xl font-black" style={{ color: C.red, opacity: Math.min(1, Math.abs(swipeOffset) / 150) }}>
            ←
          </span>
        </div>
      )}
      {hintRight && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl pointer-events-none"
          style={{ background: 'rgba(74,222,128,0.18)' }}>
          <span className="text-5xl font-black" style={{ color: C.green, opacity: Math.min(1, swipeOffset / 150) }}>
            →
          </span>
        </div>
      )}

      {/* Card position dots */}
      <div className="flex justify-center gap-1 pt-3 pb-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="rounded-full transition-all"
            style={{ width: i === rank ? 16 : 6, height: 6,
              background: i === rank ? color : 'rgba(255,255,255,0.18)' }} />
        ))}
      </div>

      {/* ── TWO-COLUMN LAYOUT: Left (image + chart/news) | Right (full-height info) */}
      <div className="grid grid-cols-2" style={{ alignItems: 'stretch' }}>

        {/* LEFT COLUMN: Image on top, chart + news below */}
        <div className="flex flex-col" style={{ borderRight: `1px solid ${C.border}` }}>

          {/* Image 1 */}
          <div className="relative overflow-hidden" style={{ minHeight: 180 }}>
            <CardImage
              src={option.imageUrl}
              alt={option.name}
              emoji={option.emoji}
              className="w-full h-full object-cover"
              style={{ minHeight: 180, maxHeight: 220 }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(13,26,13,0.55) 0%, transparent 50%)' }}
            />
            <div className="absolute bottom-2 left-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: color + '33', color, border: `1px solid ${color}55` }}>
                {option.ticker}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border }} />

          {/* Chart + News */}
          <div className="px-3 py-3 flex-1">
            <InlineChart option={option} />
            <NewsBubbles links={option.newsLinks} color={color} />
          </div>
        </div>

        {/* RIGHT COLUMN: Full-height info panel */}
        <div className="flex flex-col px-4 pt-4 pb-4 gap-3">

          {/* Company name + logo */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black leading-tight" style={{ color: C.text }}>
                {option.name}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
                style={{ background: 'rgba(255,255,255,0.08)', color: C.muted }}>
                {option.type}
              </span>
            </div>
            {/* Logo */}
            <div
              className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
              style={{ background: '#fff', border: `1px solid ${C.border}` }}
            >
              {option.logoUrl ? (
                <img
                  src={option.logoUrl}
                  alt={`${option.name} logo`}
                  className="w-full h-full object-contain p-1"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <span className="text-xl" style={{ display: option.logoUrl ? 'none' : 'flex' }}>
                {option.emoji}
              </span>
            </div>
          </div>

          {/* Gain | Risk */}
          <div className="rounded-xl px-3 py-2.5"
            style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
            <p className="text-xs" style={{ color: C.muted }}>Hist. return / yr</p>
            <p className="text-lg font-black leading-tight" style={{ color: gain ? C.green : C.red }}>
              {option.returnRangeLow}% – {option.returnRangeHigh}%
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <RiskBadge level={option.riskLevel} />
              <span className="text-xs" style={{ color: C.muted }}>{option.stabilityLabel}</span>
            </div>
          </div>

          {/* Why it fits */}
          <div className="rounded-xl px-3 py-3 flex-1"
            style={{ background: '#2a2000', border: `1px solid ${C.gold}22` }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: C.gold }}>
              💡 Why it fits you
            </p>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>
              {option.whyItFits}
            </p>
          </div>

          {/* Glossary / definitions */}
          {option.glossaryTerms?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>
                📖 Definitions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {option.glossaryTerms.map((t) => (
                  <GlossaryTerm key={t} term={t}>
                    <span className="text-xs px-2.5 py-1 rounded-full cursor-pointer"
                      style={{ background: color + '1a', color, border: `1px solid ${color}44` }}>
                      {t}
                    </span>
                  </GlossaryTerm>
                ))}
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-50 transition-opacity mt-auto"
            style={{ background: C.goldBtn, color: '#0d1a0d' }}
          >
            {confirming ? 'Saving…' : `✓ Confirm — ${option.name.split(' ')[0]}`}
          </button>

          {/* Invest widget — compact amount + how often, right under Confirm */}
          <InvestWidget
            weeklyAmount={weeklyAmount}
            initialFrequency={frequency}
            color={color}
          />
        </div>
      </div>

      {/* ── Footer: portfolio picker + legal ─────────────────────────────── */}
      <div className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <PortfolioDropdown
          portfolios={portfolios}
          checkedIds={checkedPortfolioIds}
          onToggle={togglePortfolio}
          color={color}
        />
        <p className="text-[9px] leading-relaxed" style={{ color: C.muted }}>
          Labeled historical returns are examples, not promises. No money moves until you confirm.
          Liquid Gold is not responsible for any investment losses.
        </p>
      </div>
    </div>
  );
}

// ── SwipeDeck (exported) ──────────────────────────────────────────────────────
export default function SwipeDeck({ options, weeklyAmount, holdPeriodMonths, frequency, onConfirm, confirming,
                                    portfolios, selectedPortfolioId, onPortfolioChange }) {
  const [index, setIndex]             = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging]   = useState(false);
  const dragStart = useRef(null);

  const total = options.length;

  const goTo = useCallback((i) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setSwipeOffset(0);
  }, [total]);

  function onDragStart(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStart.current = clientX;
    setIsDragging(true);
  }

  function onDragMove(e) {
    if (dragStart.current === null) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setSwipeOffset(clientX - dragStart.current);
  }

  function onDragEnd() {
    if (dragStart.current === null) return;
    dragStart.current = null;
    setIsDragging(false);
    const THRESHOLD = 80;
    if (swipeOffset < -THRESHOLD && index < total - 1) setIndex((i) => i + 1);
    else if (swipeOffset > THRESHOLD && index > 0) setIndex((i) => i - 1);
    setSwipeOffset(0);
  }

  const option = options[index];
  if (!option) return null;

  return (
    <div className="space-y-4">
      {/* Swipe zone */}
      <div
        onMouseDown={onDragStart}
        onMouseMove={isDragging ? onDragMove : undefined}
        onMouseUp={onDragEnd}
        onMouseLeave={onDragEnd}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
        style={{ touchAction: 'pan-y', userSelect: 'none' }}
      >
        <Card
          key={option.id}
          option={option}
          rank={index}
          total={total}
          weeklyAmount={weeklyAmount}
          holdPeriodMonths={holdPeriodMonths}
          frequency={frequency}
          onConfirm={onConfirm}
          confirming={confirming}
          portfolios={portfolios}
          selectedPortfolioId={selectedPortfolioId}
          swipeOffset={swipeOffset}
          isDragging={isDragging}
        />
      </div>

      {/* Arrow nav */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}
        >
          ← Prev
        </button>
        <p className="text-xs" style={{ color: C.muted }}>
          {index + 1} / {total}
        </p>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
