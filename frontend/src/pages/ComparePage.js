import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useAppContext';
import { api } from '../services/api';
import SwipeDeck from '../components/SwipeCard';

const C = {
  gold:    'var(--gold)',
  goldBtn: 'linear-gradient(135deg,#c98a00,#f0b429)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  surface: 'var(--surface)',
  surface2:'var(--surface-2)',
  border:  'var(--border)',
};

const RISK_PROFILE_LABELS = {
  conservative: 'Conservative',
  balanced:     'Balanced',
  aggressive:   'Aggressive',
};

const FREQ_LABELS = {
  'one-time': 'one-time',
  'daily':    'daily',
  'weekly':   'weekly',
  'monthly':  'monthly',
  'yearly':   'yearly',
};

function holdLabel(months) {
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.round(months / 12);
  return `${years} year${years > 1 ? 's' : ''}`;
}

export default function ComparePage() {
  const navigate = useNavigate();
  const { budget, riskProfile, holdPeriodMonths, frequency, activePortfolioId, reinvestAmount, setReinvestAmount, recommendations, setRecommendations, setConfirmed } = useApp();
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [confirming, setConfirming]         = useState(false);
  const [confirmed, setConfirmedLocal]      = useState(false);
  const [confirmedOption, setConfirmedOption] = useState(null);
  const [portfolios, setPortfolios]         = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [showMoreOpen, setShowMoreOpen]     = useState(false);
  const showMoreRef = useRef(null);

  // isReturning: has a saved risk profile from a previous session
  const isReturning = Boolean(riskProfile);

  // Load portfolios once on mount — prepend the synthetic "Original Portfolio"
  // entry, then exclude whichever portfolio drove the recommendations so the
  // user cannot double-add the same investment to it.
  useEffect(() => {
    api.getPortfolios()
      .then((res) => {
        const named = res.data.portfolios || [];
        const original = { id: '', name: 'Original Portfolio', riskProfile: riskProfile || 'balanced' };
        const all = [original, ...named];
        // activePortfolioId === null means no portfolio was chosen on BudgetPage
        // (first-time user); show everything. Otherwise hide the active one.
        const filtered = activePortfolioId === null
          ? all
          : all.filter((p) => p.id !== activePortfolioId);
        setPortfolios(filtered);
      })
      .catch(() => {});
  }, [riskProfile, activePortfolioId]);

  // Close "Show More" dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (showMoreRef.current && !showMoreRef.current.contains(e.target)) {
        setShowMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!budget.weeklyAmount || !riskProfile) return;
    if (recommendations) return;

    async function fetchRecs() {
      setLoading(true);
      setError('');
      try {
        const res = await api.getRecommendations({
          weeklyAmount: parseFloat(budget.weeklyAmount),
          holdPeriodMonths,
          riskProfile,
        });
        if (res.data.guardrail === 'stale') {
          setError(res.data.message);
        } else {
          setRecommendations(res.data);
        }
      } catch {
        setError('Could not reach the server. Check that the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchRecs();
  }, [budget, riskProfile, holdPeriodMonths, recommendations, setRecommendations]);

  // checkedIds: array of portfolio IDs ticked in the SwipeCard dropdown.
  // Rules:
  //  • If the user ticked ≥1 portfolios → save one entry per ticked portfolio.
  //  • If nothing was ticked → save one entry under activePortfolioId
  //    (the portfolio that drove recommendations, '' = Original Portfolio, null = none).
  async function handleConfirm(option, checkedIds) {
    setConfirming(true);
    const amount = parseFloat(budget.weeklyAmount);

    // Determine which portfolio IDs to allocate to
    const targetIds = (checkedIds && checkedIds.length > 0)
      ? checkedIds
      : [activePortfolioId ?? ''];

    try {
      // Save one history entry per target portfolio.
      // fromCashBalance is only sent on the first entry when reinvesting — the full
      // deduction happens once regardless of how many portfolios were ticked.
      await Promise.all(
        targetIds.map((pid, idx) => {
          return api.confirmChoice({
            optionId:        option.id,
            optionName:      option.name,
            amount,
            riskLevel:       option.riskLevel,
            whyItFits:       option.whyItFits,
            dataSource:      option.dataSource,
            portfolioId:     pid,
            // Deduct cash balance only once (first entry) to avoid double-deduction
            fromCashBalance: idx === 0 && reinvestAmount != null ? reinvestAmount : undefined,
          });
        })
      );
      // Clear the reinvest context so a subsequent normal invest doesn't re-deduct
      setReinvestAmount(null);
      setConfirmed(option);
      setConfirmedOption(option);
      setConfirmedLocal(true);
    } catch {
      alert('Could not save your choice. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  function refresh() {
    setRecommendations(null);
    setConfirmedLocal(false);
    setConfirmedOption(null);
    setSelectedPortfolioId('');
    setShowMoreOpen(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 rounded-full border-4 animate-spin"
          style={{ borderColor: C.gold, borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: C.muted }}>Finding your best options…</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card text-center py-10 space-y-4">
        <p style={{ color: '#f87171' }}>{error}</p>
        <button onClick={refresh} className="px-6 py-2 rounded-xl text-sm"
          style={{ border: `1px solid ${C.border}`, color: C.muted }}>
          Try again
        </button>
      </div>
    );
  }

  // ── Confirmed ──────────────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="card text-center py-10 space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold" style={{ color: C.text }}>Choice saved!</h2>
        <p className="text-sm" style={{ color: C.muted }}>
          <strong style={{ color: C.text }}>{confirmedOption?.name}</strong> — ${budget.weeklyAmount} ({FREQ_LABELS[frequency] || 'weekly'}) added to your history.
        </p>
        <p className="text-xs" style={{ color: C.muted }}>No money moves. This is a paper record only.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: C.goldBtn, color: '#0d1a0d' }}>
            View dashboard
          </button>
          <button onClick={refresh} className="px-5 py-2.5 rounded-xl text-sm"
            style={{ border: `1px solid ${C.border}`, color: C.muted }}>
            New recommendation
          </button>
        </div>
      </div>
    );
  }

  if (!recommendations) return null;

  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);
  const { options, dataSource, lastUpdated } = recommendations;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate(isReturning ? '/start' : '/risk-check')}
            className="text-sm hover:underline"
            style={{ color: C.muted }}
          >
            {isReturning ? '← Change portfolio' : '← Edit risk'}
          </button>
          <h1 className="text-xl font-bold mt-1" style={{ color: C.text }}>Your options</h1>
          <p className="text-sm" style={{ color: C.muted }}>
            ${budget.weeklyAmount} · {FREQ_LABELS[frequency] || 'weekly'} · {holdLabel(holdPeriodMonths)} ·{' '}
            {selectedPortfolio
              ? <span className="font-medium">{selectedPortfolio.name}</span>
              : <span className="font-medium">{RISK_PROFILE_LABELS[riskProfile]} risk</span>
            }
          </p>
        </div>

        {/* Show More dropdown — replaces the old Refresh button */}
        <div className="relative" ref={showMoreRef}>
          <button
            onClick={() => setShowMoreOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: showMoreOpen ? C.surface2 : 'transparent',
              border: `1px solid ${showMoreOpen ? C.border : 'transparent'}`,
              color: C.gold,
            }}
          >
            Show more ▾
          </button>

          {showMoreOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-30 rounded-xl overflow-hidden min-w-[200px]"
              style={{ background: C.surface2, border: `1px solid ${C.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            >
              {[
                { icon: '🔄', label: 'New recommendations',  action: refresh },
                { icon: '⚙️', label: 'Change risk profile',  action: () => { setShowMoreOpen(false); navigate('/risk-check'); } },
                { icon: '💼', label: 'Change budget',         action: () => { setShowMoreOpen(false); navigate('/start'); } },
                { icon: '📊', label: 'View dashboard',        action: () => { setShowMoreOpen(false); navigate('/dashboard'); } },
                { icon: '📁', label: 'Manage portfolios',     action: () => { setShowMoreOpen(false); navigate('/settings'); } },
              ].map(({ icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                  style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}
                  onMouseOver={e => e.currentTarget.style.background = '#243d24'}
                  onMouseOut={e => e.currentTarget.style.background = ''}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Swipe deck — the main event */}
      <SwipeDeck
        options={options}
        weeklyAmount={budget.weeklyAmount}
        holdPeriodMonths={holdPeriodMonths}
        frequency={frequency}
        onConfirm={handleConfirm}
        confirming={confirming}
        portfolios={portfolios}
        selectedPortfolioId={selectedPortfolioId}
        onPortfolioChange={setSelectedPortfolioId}
      />

      {/* Source footer */}
      <p className="text-xs text-center px-2" style={{ color: C.muted }}>
        Source: {dataSource} · updated {lastUpdated}
      </p>
      <p className="text-xs text-center px-4 leading-relaxed" style={{ color: C.muted }}>
        Not financial advice. We are not responsible for any losses incurred
        through investing. All decisions are yours alone.
      </p>
    </div>
  );
}
