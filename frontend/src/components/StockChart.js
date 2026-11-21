import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';

/**
 * StockChart — fetches 90-day prices and renders a sparkline.
 * Props: symbol, height (default 80), compact (bool)
 */
export default function StockChart({ symbol, height = 80, compact = false }) {
  const [state, setState]   = useState('loading');
  const [prices, setPrices] = useState([]);
  const [ticker, setTicker] = useState('');
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!symbol || fetchedRef.current) return;
    fetchedRef.current = true;

    api.getChartData(symbol)
      .then((res) => {
        const { prices: p, symbol: sym } = res.data;
        setTicker(sym || symbol.toUpperCase());
        if (!p || p.length < 2) {
          setState('unavailable');
        } else {
          setPrices(p);
          setState('ok');
        }
      })
      .catch(() => setState('unavailable'));
  }, [symbol]);

  if (state === 'loading') {
    return (
      <div
        className="rounded-xl animate-pulse"
        style={{ height, background: 'var(--surface-2)' }}
      />
    );
  }

  if (state === 'unavailable') {
    return (
      <div
        className="rounded-xl flex items-center justify-center"
        style={{ height, background: 'var(--surface-2)' }}
      >
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Chart unavailable — add Alpha Vantage key</p>
      </div>
    );
  }

  return <SparklineChart prices={prices} ticker={ticker} height={height} compact={compact} />;
}

function SparklineChart({ prices, ticker, height, compact }) {
  const W     = 400;
  const H     = height;
  const PAD_X = compact ? 0 : 4;
  const PAD_Y = compact ? 4 : 8;

  const closes = prices.map((p) => p.close);
  const minVal = Math.min(...closes);
  const maxVal = Math.max(...closes);
  const range  = maxVal - minVal || 1;

  const toX = (i) => PAD_X + (i / (closes.length - 1)) * (W - PAD_X * 2);
  const toY = (v) => PAD_Y + (1 - (v - minVal) / range) * (H - PAD_Y * 2);

  const points   = closes.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const polyline = `M ${points.replace(/ /g, ' L ')}`;
  const fillPath = `${polyline} L ${toX(closes.length - 1)},${H} L ${toX(0)},${H} Z`;

  const firstClose = closes[0];
  const lastClose  = closes[closes.length - 1];
  const changePct  = (((lastClose - firstClose) / firstClose) * 100).toFixed(1);
  const isUp       = lastClose >= firstClose;
  const lineColor  = isUp ? 'var(--low)' : 'var(--high)';
  const fillId     = `grad-${ticker}`;

  return (
    <div className="rounded-xl overflow-hidden relative" style={{ height, background: 'var(--surface-2)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#${fillId})`} />
        <path
          d={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={toX(closes.length - 1)} cy={toY(lastClose)} r="3" fill={lineColor} />
      </svg>

      {!compact && (
        <div className="absolute top-1.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
          >
            {ticker} · 90d
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={
              isUp
                ? { background: 'var(--bg-risk-low)',  color: 'var(--low)'  }
                : { background: 'var(--bg-risk-high)', color: 'var(--high)' }
            }
          >
            {isUp ? '▲' : '▼'} {Math.abs(changePct)}%
          </span>
        </div>
      )}

      {!compact && (
        <div className="absolute bottom-1 left-2.5 right-2.5 flex items-end justify-between pointer-events-none">
          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>${minVal.toFixed(0)}</span>
          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>${maxVal.toFixed(0)}</span>
        </div>
      )}
    </div>
  );
}
