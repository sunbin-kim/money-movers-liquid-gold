import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import RiskBadge from '../components/RiskBadge';

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

const TYPE_FILTERS = [
  { id: 'all',   label: 'All' },
  { id: 'etf',   label: 'ETFs' },
  { id: 'stock', label: 'Stocks' },
  { id: 'other', label: 'Other' },
];

const RISK_FILTERS = [
  { id: 'all',    label: 'Any risk' },
  { id: 'low',    label: '🛡️ Safe' },
  { id: 'medium', label: '⚖️ Mixed' },
  { id: 'high',   label: '🚀 Volatile' },
];

function typeKey(type) {
  if (!type) return 'other';
  const t = type.toLowerCase();
  if (t.includes('stock')) return 'stock';
  if (t.includes('etf') || t.includes('bond') || t.includes('commodity') || t.includes('reit'))
    return 'etf';
  return 'other';
}

function returnLabel(low, high) {
  if (low < 0) return `${low}% to +${high}%`;
  return `+${low}% to +${high}%`;
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ option, onInvest }) {
  const [expanded, setExpanded] = useState(false);

  const returnColor = option.returnRangeHigh >= 15
    ? C.red
    : option.returnRangeHigh >= 8
    ? C.gold
    : C.green;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ background: C.surface2, border: `1px solid ${C.border}` }}
    >
      {/* Card header — always visible */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Colour strip using the option's brand gradient */}
        <div
          className="relative flex items-center gap-3 px-4 pt-4 pb-3"
          style={{ borderBottom: expanded ? `1px solid ${C.border}` : 'none' }}
        >
          {/* Emoji badge */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-2xl"
            style={{ background: option.bgGradient, border: `1px solid ${option.color}44` }}
          >
            {option.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + ticker */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold leading-tight" style={{ color: C.text }}>
                {option.name}
              </p>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: option.color + '22', color: option.color }}
              >
                {option.ticker}
              </span>
            </div>
            {/* Type + stability */}
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>
              {option.type} · {option.stabilityLabel}
            </p>
          </div>

          {/* Right side: risk + return */}
          <div className="text-right shrink-0">
            <RiskBadge level={option.riskLevel} />
            <p className="text-[10px] mt-1 font-semibold" style={{ color: returnColor }}>
              {returnLabel(option.returnRangeLow, option.returnRangeHigh)} / yr
            </p>
          </div>
        </div>

        {/* Headline — always visible */}
        <div className="px-4 pb-3">
          <p className="text-xs leading-snug" style={{ color: C.muted }}>
            {option.headline}
          </p>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${C.border}` }}>

          {/* Plain reason */}
          <p className="text-sm leading-relaxed pt-3" style={{ color: C.text }}>
            {option.plainReason}
          </p>

          {/* Return range bar */}
          <div
            className="rounded-xl px-3 py-2.5 flex items-center justify-between"
            style={{ background: C.surface }}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>
                Labeled historical return
              </p>
              <p className="text-sm font-bold" style={{ color: returnColor }}>
                {returnLabel(option.returnRangeLow, option.returnRangeHigh)} per year
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: C.muted }}>
                Min. amount
              </p>
              <p className="text-sm font-bold" style={{ color: C.text }}>
                ${option.minAmount}
              </p>
            </div>
          </div>

          {/* Glossary terms */}
          {option.glossaryTerms?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {option.glossaryTerms.map((term) => (
                <span
                  key={term}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}
                >
                  {term}
                </span>
              ))}
            </div>
          )}

          {/* News links */}
          {option.newsLinks?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>
                Learn more
              </p>
              <div className="flex flex-wrap gap-1.5">
                {option.newsLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2.5 py-1 rounded-full font-semibold transition-colors"
                    style={{
                      background: option.color + '18',
                      color: option.color,
                      border: `1px solid ${option.color}33`,
                    }}
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => onInvest(option)}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: C.goldBtn, color: '#0d1a0d' }}
          >
            Invest in {option.ticker} →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BrowsePage() {
  const navigate = useNavigate();
  const [options, setOptions]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter]  = useState('all');
  const [riskFilter, setRiskFilter]  = useState('all');

  useEffect(() => {
    api.getBrowseOptions()
      .then((res) => setOptions(res.data.options || []))
      .catch(() => setError('Could not load options. Check the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = options;

    if (typeFilter !== 'all') {
      list = list.filter((o) => typeKey(o.type) === typeFilter);
    }
    if (riskFilter !== 'all') {
      list = list.filter((o) => o.riskLevel === riskFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.ticker.toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q) ||
          o.headline.toLowerCase().includes(q)
      );
    }

    return list;
  }, [options, typeFilter, riskFilter, search]);

  function handleInvest(option) {
    // Navigate to the invest flow; BudgetPage will show the portfolio picker
    navigate('/start');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="w-8 h-8 rounded-full border-4 animate-spin"
          style={{ borderColor: C.gold, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm" style={{ color: C.red }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: C.text }}>🔍 Browse options</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          Explore every investment available · tap any card to see details
        </p>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: C.surface2, border: `1px solid ${C.border}` }}
      >
        <span style={{ color: C.muted }}>🔎</span>
        <input
          type="text"
          placeholder="Search by name, ticker, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: C.text }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ color: C.muted, fontSize: 12 }}>✕</button>
        )}
      </div>

      {/* Type filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setTypeFilter(f.id)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={
              typeFilter === f.id
                ? { background: C.gold, color: '#0d1a0d', borderColor: C.gold }
                : { background: C.surface, color: C.muted, borderColor: C.border }
            }
          >
            {f.label}
          </button>
        ))}

        <div className="w-px mx-1 self-stretch" style={{ background: C.border }} />

        {RISK_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setRiskFilter(f.id)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={
              riskFilter === f.id
                ? { background: C.gold, color: '#0d1a0d', borderColor: C.gold }
                : { background: C.surface, color: C.muted, borderColor: C.border }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs" style={{ color: C.muted }}>
        {filtered.length} option{filtered.length !== 1 ? 's' : ''}
        {typeFilter !== 'all' || riskFilter !== 'all' || search ? ' matching your filters' : ' available'}
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm" style={{ color: C.muted }}>No options match your filters.</p>
          <button
            onClick={() => { setTypeFilter('all'); setRiskFilter('all'); setSearch(''); }}
            className="mt-3 text-xs underline"
            style={{ color: C.gold }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((option) => (
            <OptionCard key={option.id} option={option} onInvest={handleInvest} />
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-center px-4 pb-4 leading-relaxed" style={{ color: C.muted }}>
        Labeled historical returns are examples, not promises.
        No money moves until you confirm in the Invest tab. Not financial advice.
      </p>
    </div>
  );
}
