/**
 * AwardsPage.js — Trophy cabinet.
 *
 * Clean grid layout with:
 *  - Overall stats bar at the top
 *  - Per-portfolio expandable cards (cleaned up, no nested tier legend)
 *  - Confetti + toast popup when a new trophy is detected on first load
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  gold:    'var(--gold)',
  goldBtn: 'linear-gradient(135deg,#c98a00,#f0b429)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  surface: 'var(--surface)',
  surface2:'var(--surface-2)',
  border:  'var(--border)',
  red:     'var(--high)',
  green:   'var(--low)',
  bg:      'var(--bg)',
};

// Tier display config
const TIER_META = {
  coal:          { label: 'Coal',          glow: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  legend:        { label: 'Legend',        glow: '#c084fc', bg: 'rgba(192,132,252,0.15)' },
  diamond:       { label: 'Diamond',       glow: '#67e8f9', bg: 'rgba(103,232,249,0.12)' },
  platinum:      { label: 'Platinum',      glow: '#e2e8f0', bg: 'rgba(226,232,240,0.12)' },
  gold:          { label: 'Gold',          glow: '#f0b429', bg: 'rgba(240,180,41,0.15)'  },
  silver:        { label: 'Silver',        glow: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  bronze:        { label: 'Bronze',        glow: '#cd7f32', bg: 'rgba(205,127,50,0.15)'  },
  special:       { label: 'Special',       glow: '#86efac', bg: 'rgba(134,239,172,0.12)' },
  participation: { label: 'Participation', glow: '#78716c', bg: 'rgba(120,113,108,0.15)' },
};

const TIER_ORDER = ['legend', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];
const PERIOD_ORDER = ['day', 'week', 'month', '6months', 'year', 'alltime'];

// Tiers are computed purely from changePercent — backend award field is not used for display.
const TIER_CHIPS = [
  { emoji: '🪨', label: 'Coal',     pct: '< 0%',    tier: 'coal',     min: -Infinity, max: 0,    desc: 'Overall portfolio growth is negative'    },
  { emoji: '🥉', label: 'Bronze',   pct: '≥5%',     tier: 'bronze',   min: 5,         max: 10,   desc: 'Portfolio growth of +5% or more'          },
  { emoji: '🥈', label: 'Silver',   pct: '≥10%',    tier: 'silver',   min: 10,        max: 25,   desc: 'Portfolio growth of +10% or more'         },
  { emoji: '🥇', label: 'Gold',     pct: '≥25%',    tier: 'gold',     min: 25,        max: 50,   desc: 'Portfolio growth of +25% or more'         },
  { emoji: '🏆', label: 'Platinum', pct: '≥50%',    tier: 'platinum', min: 50,        max: 100,  desc: 'Portfolio growth of +50% or more'         },
  { emoji: '💎', label: 'Diamond',  pct: '≥100%',   tier: 'diamond',  min: 100,       max: 1000, desc: 'Portfolio growth of +100% or more'        },
  { emoji: '🔥', label: 'Legend',   pct: '≥1000%',  tier: 'legend',   min: 1000,      max: Infinity, desc: 'Legendary portfolio growth of +1000%+' },
];

/** Derive a tier object from a changePercent value. Returns null if 0 ≤ pct < 5 (no tier yet). */
function tierFromPct(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct < 0)    return TIER_CHIPS[0]; // coal
  if (pct >= 1000) return TIER_CHIPS[6]; // legend
  if (pct >= 100)  return TIER_CHIPS[5]; // diamond
  if (pct >= 50)   return TIER_CHIPS[4]; // platinum
  if (pct >= 25)   return TIER_CHIPS[3]; // gold
  if (pct >= 10)   return TIER_CHIPS[2]; // silver
  if (pct >= 5)    return TIER_CHIPS[1]; // bronze
  return null; // 0–4.99%: no tier yet
}

// Known special awards a user can aim for (shown in the "not yet unlocked" section)
const KNOWN_SPECIAL_AWARDS = [
  { id: 'first_investment', emoji: '🌱', tier: 'special',  label: 'First Investment',    desc: 'Make your very first investment move.' },
  { id: 'diversified',      emoji: '🌍', tier: 'special',  label: 'Diversified',          desc: 'Hold investments across 3 or more different assets.' },
  { id: 'consistent',       emoji: '📅', tier: 'platinum', label: 'Consistent Investor',  desc: 'Invest every week for 4 consecutive weeks.' },
  { id: 'big_spender',      emoji: '💸', tier: 'gold',     label: 'Big Spender',          desc: 'Invest a total of $1,000 or more.' },
  { id: 'diamond_hands',    emoji: '🙌', tier: 'diamond',  label: 'Diamond Hands',        desc: 'Hold a position for more than 6 months.' },
  { id: 'shadow_master',    emoji: '👁️', tier: 'silver',   label: 'Shadow Master',        desc: 'Shadow 3 or more friend portfolios.' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-4 animate-spin"
        style={{ borderColor: C.gold, borderTopColor: 'transparent' }} />
    </div>
  );
}

/** Best tier across all periods, computed from changePercent. */
function bestTier(periods) {
  let best = null;
  for (const p of periods) {
    if (p.totalInvested <= 0) continue;
    const t = tierFromPct(p.changePercent);
    if (!t) continue;
    if (!best) { best = t; continue; }
    // Coal is "worst", so never replace a real tier with coal
    if (t.tier === 'coal') continue;
    if (best.tier === 'coal' || TIER_ORDER.indexOf(t.tier) < TIER_ORDER.indexOf(best.tier)) {
      best = t;
    }
  }
  return best;
}

// ── Canvas confetti ───────────────────────────────────────────────────────────
// Pure-JS particle confetti — no external file needed.
const CONFETTI_COLORS = [
  '#f0b429','#4ade80','#67e8f9','#f87171','#c084fc',
  '#fbbf24','#86efac','#fb923c','#38bdf8','#e879f9',
];

function Confetti({ active, onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn particles
    const particles = Array.from({ length: 160 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * -canvas.height * 0.5,
      w:    6 + Math.random() * 8,
      h:    4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx:   (Math.random() - 0.5) * 3,
      vy:   2.5 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      spin:  (Math.random() - 0.5) * 0.18,
      opacity: 1,
    }));

    let frame;
    let elapsed = 0;
    const DURATION = 3400; // ms
    let last = performance.now();

    function animate(now) {
      const dt = now - last;
      last = now;
      elapsed += dt;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const fade = elapsed > DURATION * 0.7
        ? 1 - (elapsed - DURATION * 0.7) / (DURATION * 0.3)
        : 1;

      for (const p of particles) {
        p.x     += p.vx;
        p.y     += p.vy;
        p.angle += p.spin;
        p.vy    += 0.06; // gravity

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity * fade);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < DURATION) {
        frame = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone?.();
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        pointerEvents: 'none', zIndex: 9999,
        width: '100%', height: '100%',
      }}
    />
  );
}

// ── Trophy unlock toast ───────────────────────────────────────────────────────
function TrophyToast({ award, onClose }) {
  const meta = TIER_META[award?.tier] || TIER_META.special;

  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, minWidth: 280, maxWidth: 360,
        background: C.surface, border: `1.5px solid ${meta.glow}88`,
        borderRadius: 20, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: `0 8px 40px ${meta.glow}44`,
        animation: 'toastDrop .4s cubic-bezier(.34,1.56,.64,1) forwards',
      }}
    >
      <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{award.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, color: meta.glow, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 3 }}>
          🎉 Trophy unlocked!
        </p>
        <p style={{ fontSize: 16, fontWeight: 800, color: meta.glow, lineHeight: 1.2 }}>{award.label}</p>
        {award.desc && (
          <p style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{award.desc}</p>
        )}
      </div>
      <button
        onClick={onClose}
        style={{ color: C.muted, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}

// ── Period row (compact) ──────────────────────────────────────────────────────
function PeriodRow({ period }) {
  const { periodLabel, totalInvested, currentValue, changePercent } = period;
  const gain = changePercent >= 0;
  // Tier is computed entirely from changePercent — backend award is not used for display.
  const tierChip = totalInvested > 0 ? tierFromPct(changePercent) : null;
  const meta = tierChip ? TIER_META[tierChip.tier] : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2"
      style={{ borderBottom: `1px solid ${C.border}33` }}>
      <p className="text-xs font-semibold w-20 shrink-0" style={{ color: C.muted }}>{periodLabel}</p>

      {totalInvested > 0 ? (
        <p className="text-xs flex-1 truncate" style={{ color: C.muted }}>
          ${totalInvested.toFixed(0)} → ${currentValue.toFixed(0)}{' '}
          <span style={{ color: gain ? C.green : C.red }}>
            ({gain ? '+' : ''}{changePercent}%)
          </span>
        </p>
      ) : (
        <p className="text-xs flex-1" style={{ color: C.border }}>No activity</p>
      )}

      {tierChip ? (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: meta.bg, color: meta.glow, border: `1px solid ${meta.glow}44`, whiteSpace: 'nowrap' }}
        >
          {tierChip.emoji} {tierChip.label}
        </span>
      ) : (
        <span className="text-xs shrink-0" style={{ color: C.border }}>—</span>
      )}
    </div>
  );
}

// ── Portfolio card ────────────────────────────────────────────────────────────
function PortfolioCard({ data }) {
  const { portfolioName, totalEntries, periods, specialAwards } = data;
  const [open, setOpen] = useState(portfolioName === '🌐 Overall');

  // Portfolio tier = tier of the overall (alltime) period performance
  const overallPeriod = periods.find((p) => p.periodId === 'alltime') || periods[periods.length - 1];
  const displayTier = overallPeriod && overallPeriod.totalInvested > 0
    ? tierFromPct(overallPeriod.changePercent)
    : null;
  const bestMeta = displayTier ? TIER_META[displayTier.tier] : null;
  // Best tier across individual periods (for the card border accent)
  const best = bestTier(periods);
  const earnedCount = periods.filter((p) => p.award).length + specialAwards.length;

  // Overall % values for display
  const overallPct  = overallPeriod?.totalInvested > 0 ? overallPeriod.changePercent : null;
  const overallGain = overallPct !== null && overallPct >= 0;

  // Next tier the user should aim for
  const nextTierChip = (() => {
    if (!displayTier) return TIER_CHIPS[1]; // aim for bronze
    const idx = TIER_CHIPS.findIndex((t) => t.tier === displayTier.tier);
    return TIER_CHIPS[idx + 1] || null; // null = already Legend
  })();

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{
        border: `1px solid ${bestMeta ? bestMeta.glow + '44' : C.border}`,
        background: C.surface,
      }}>

      {/* Header */}
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: bestMeta ? bestMeta.bg : C.surface2 }}
        onClick={() => setOpen((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{displayTier ? displayTier.emoji : (totalEntries > 0 ? '🏅' : '📭')}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: C.text }}>{portfolioName}</p>
            <p className="text-xs" style={{ color: C.muted }}>
              {totalEntries} move{totalEntries !== 1 ? 's' : ''} · {earnedCount} special award{earnedCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Overall % badge */}
          {overallPct !== null ? (
            <span className="text-sm font-bold"
              style={{ color: overallGain ? C.green : C.red }}>
              {overallGain ? '+' : ''}{overallPct}%
            </span>
          ) : null}

          {/* Tier badge */}
          {displayTier && bestMeta ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: bestMeta.bg, color: bestMeta.glow, border: `1px solid ${bestMeta.glow}55` }}>
              {displayTier.emoji} {bestMeta.label}
            </span>
          ) : overallPct !== null ? (
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
              No tier yet
            </span>
          ) : null}

          <span style={{ color: C.muted, fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Progress bar toward next tier */}
      {overallPct !== null && nextTierChip && overallPct >= 0 && (
        <div className="px-4 py-1.5" style={{ background: C.surface2, borderBottom: `1px solid ${C.border}33` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px]" style={{ color: C.muted }}>
              Overall growth · {overallPct >= 0 ? '+' : ''}{overallPct}% → next: {nextTierChip.emoji} {nextTierChip.label} ({nextTierChip.pct})
            </span>
            <span className="text-[10px] font-semibold" style={{ color: C.muted }}>
              {Math.min(100, Math.round((overallPct / nextTierChip.min) * 100))}%
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 4, background: C.border }}>
            <div
              className="rounded-full h-full transition-all"
              style={{
                width: `${Math.min(100, Math.round((overallPct / nextTierChip.min) * 100))}%`,
                background: nextTierChip ? TIER_META[nextTierChip.tier]?.glow : C.gold,
              }}
            />
          </div>
        </div>
      )}

      {open && (
        <div className="px-4 pt-2 pb-4 space-y-5">
          {/* Growth periods */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
              Growth by period
            </p>
            <div>
              {PERIOD_ORDER.map((pid) => {
                const p = periods.find((x) => x.periodId === pid);
                return p ? <PeriodRow key={pid} period={p} /> : null;
              })}
            </div>
          </div>

          {/* Special awards */}
          {specialAwards.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
                Special awards
              </p>
              <div className="space-y-2">
                {specialAwards.map((a) => {
                  const m = TIER_META[a.tier] || TIER_META.special;
                  return (
                    <div key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: m.bg, border: `1px solid ${m.glow}33` }}>
                      <span className="text-xl mt-0.5 shrink-0">{a.emoji}</span>
                      <div>
                        <p className="text-sm font-bold" style={{ color: m.glow }}>{a.label}</p>
                        <p className="text-xs leading-relaxed" style={{ color: C.text }}>{a.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {earnedCount === 0 && totalEntries === 0 && (
            <p className="text-sm text-center py-3" style={{ color: C.muted }}>
              No investments yet — make your first move to earn trophies.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AwardsPage({ userId = null, compact = false }) {
  const [awards, setAwards]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Confetti / toast state
  const [toastAward, setToastAward]       = useState(null);
  const [showConfetti, setShowConfetti]   = useState(false);

  // Award keys are persisted in localStorage so the "first visit" confetti fires
  // the very first time the user opens the Trophy Cabinet with earned trophies,
  // not just when they reload within the same session.
  const LS_KEY = 'lg_seen_awards';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = userId
        ? await api.getFriendAwards(userId)
        : await api.getAwards();
      const incoming = res.data.awards || [];

      if (!userId) {
        // Build the full set of keys for the current response
        const currentKeys = new Set();
        for (const portfolio of incoming) {
          for (const p of portfolio.periods) {
            if (p.award) currentKeys.add(`${portfolio.portfolioId}:${p.periodId}:${p.award.tier}`);
          }
          for (const a of portfolio.specialAwards) {
            currentKeys.add(`${portfolio.portfolioId}:special:${a.id}`);
          }
        }

        // Load previously seen keys from localStorage
        let prevKeys;
        try {
          const stored = localStorage.getItem(LS_KEY);
          prevKeys = stored ? new Set(JSON.parse(stored)) : null;
        } catch { prevKeys = null; }

        // ── Detect newly unlocked trophies ────────────────────────────────────
        // prevKeys === null  → first ever visit → fire confetti for the first
        //                      trophy found (so the experience feels celebratory).
        // prevKeys is a Set  → subsequent visits → fire only for genuinely new keys.
        if (currentKeys.size > 0) {
          let newAward = null;
          outer: for (const portfolio of incoming) {
            for (const period of portfolio.periods) {
              if (!period.award) continue;
              const key = `${portfolio.portfolioId}:${period.periodId}:${period.award.tier}`;
              if (!prevKeys || !prevKeys.has(key)) { newAward = period.award; break outer; }
            }
            for (const a of portfolio.specialAwards) {
              const key = `${portfolio.portfolioId}:special:${a.id}`;
              if (!prevKeys || !prevKeys.has(key)) { newAward = a; break outer; }
            }
          }

          if (newAward) {
            setToastAward(newAward);
            setShowConfetti(true);
          }
        }

        // Persist the current state so the next visit knows what was already seen
        try {
          localStorage.setItem(LS_KEY, JSON.stringify([...currentKeys]));
        } catch { /* storage quota exceeded — non-fatal */ }
      }

      setAwards(incoming);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load awards.');
      setAwards([]);
    } finally {
      setLoading(false);
    }
  }, [userId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <p className="text-sm px-3 py-2 rounded-lg"
        style={{ color: C.red, background: 'rgba(248,113,113,0.1)' }}>
        {error}
      </p>
    );
  }

  // ── Totals for the stats bar ───────────────────────────────────────────────
  let totalEarned = 0;
  let totalMoves  = 0;
  if (awards) {
    for (const p of awards) {
      totalMoves  += p.totalEntries;
      totalEarned += p.periods.filter((x) => x.award).length + p.specialAwards.length;
    }
  }

  // ── Compute which special awards are still locked ─────────────────────────
  const earnedSpecialIds = new Set();
  if (awards) {
    for (const p of awards) {
      for (const a of p.specialAwards) {
        if (a.id) earnedSpecialIds.add(a.id);
      }
    }
  }
  const lockedSpecials = KNOWN_SPECIAL_AWARDS.filter((a) => !earnedSpecialIds.has(a.id));

  if (compact) {
    return (
      <div className="space-y-2">
        {awards.map((a) => <PortfolioCard key={a.portfolioId} data={a} />)}
      </div>
    );
  }

  return (
    <>
      {/* ── Keyframes (toast only — confetti uses canvas) ─────────────────── */}
      <style>{`
        @keyframes toastDrop {
          from { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(0.95); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1);    }
        }
      `}</style>

      {/* Confetti overlay */}
      <Confetti active={showConfetti} onDone={() => setShowConfetti(false)} />

      {/* Toast */}
      {toastAward && (
        <TrophyToast award={toastAward} onClose={() => setToastAward(null)} />
      )}

      <div className="space-y-5">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold" style={{ color: C.text }}>🏆 Trophy Cabinet</h1>
          <p className="text-sm" style={{ color: C.muted }}>
            Earn trophies by growing your investments across each time period.
          </p>
        </div>

        {/* ── Stats bar ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Trophies earned', value: totalEarned, emoji: '🏆' },
            { label: 'Total moves',     value: totalMoves,  emoji: '📈' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl px-4 py-3"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <p className="text-2xl font-bold mb-0.5" style={{ color: C.gold }}>{s.value}</p>
              <p className="text-xs" style={{ color: C.muted }}>{s.emoji} {s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tier scale (compact chips row) ──────────────────────────────── */}
        <div className="rounded-2xl px-4 py-3"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: C.muted }}>
            Tier thresholds
          </p>
          <div className="flex flex-wrap gap-2">
            {TIER_CHIPS.map((t) => {
              const meta = TIER_META[t.tier];
              // Earned = any period in any portfolio hits this tier's threshold (from changePercent)
              const earned = awards?.some((p) =>
                p.periods.some((x) => x.totalInvested > 0 && tierFromPct(x.changePercent)?.tier === t.tier)
              );
              return (
                <div key={t.tier}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: earned ? meta.bg : 'transparent',
                    border:     `1px solid ${earned ? meta.glow + '55' : C.border}`,
                    color:      earned ? meta.glow : C.muted,
                    opacity:    earned ? 1 : 0.55,
                  }}>
                  <span>{t.emoji}</span>
                  <span className="font-semibold">{t.label}</span>
                  <span>{t.pct}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {totalMoves === 0 && (
          <div className="rounded-2xl text-center py-12 space-y-3"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-5xl">🏅</p>
            <p className="font-bold" style={{ color: C.text }}>No awards yet</p>
            <p className="text-sm max-w-xs mx-auto" style={{ color: C.muted }}>
              Make your first investment to unlock trophies.
            </p>
          </div>
        )}

        {/* ── Portfolio cards ──────────────────────────────────────────────── */}
        <div className="space-y-3">
          {awards.map((a) => <PortfolioCard key={a.portfolioId} data={a} />)}
        </div>

        {/* ── Not yet unlocked special awards ──────────────────────────────── */}
        {lockedSpecials.length > 0 && (
          <div className="rounded-2xl px-4 py-4"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.muted }}>
              🔒 Special awards to aim for
            </p>
            <div className="space-y-2">
              {lockedSpecials.map((a) => {
                const meta = TIER_META[a.tier] || TIER_META.special;
                return (
                  <div key={a.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: C.surface2, border: `1px solid ${C.border}`, opacity: 0.72 }}>
                    <span className="text-xl opacity-40 shrink-0">{a.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: meta.glow }}>{a.label}</p>
                      <p className="text-xs" style={{ color: C.muted }}>{a.desc}</p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: meta.bg, color: meta.glow, border: `1px solid ${meta.glow}33` }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
