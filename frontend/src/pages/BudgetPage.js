import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useAppContext';
import { api } from '../services/api';

const HOLD_OPTIONS = [
  { label: '1 month',  value: 1  },
  { label: '3 months', value: 3  },
  { label: '6 months', value: 6  },
  { label: '1 year',   value: 12 },
  { label: '2 years',  value: 24 },
  { label: '5+ years', value: 60 },
];

const FREQUENCY_OPTIONS = [
  { id: 'one-time', label: 'One-time',  sublabel: 'Single payment',         emoji: '⚡' },
  { id: 'daily',    label: 'Daily',     sublabel: 'Every day',              emoji: '📆' },
  { id: 'weekly',   label: 'Weekly',    sublabel: 'Once a week',            emoji: '📅' },
  { id: 'monthly',  label: 'Monthly',   sublabel: 'Once a month',           emoji: '🗓️' },
  { id: 'yearly',   label: 'Yearly',    sublabel: 'Once a year',            emoji: '📊' },
];

const RISK_META = {
  conservative: { emoji: '🛡️', label: 'Conservative', color: '#4ade80' },
  balanced:     { emoji: '⚖️', label: 'Balanced',     color: '#fbbf24' },
  aggressive:   { emoji: '🚀', label: 'Aggressive',   color: '#f87171' },
};

function holdLabel(months) {
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const y = Math.round(months / 12);
  return `${y} year${y > 1 ? 's' : ''}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { budget, setBudget, holdPeriodMonths, setHoldPeriodMonths, riskProfile, setRiskProfile, frequency, setFrequency, setActivePortfolioId, setReinvestAmount } = useApp();

  // If the user arrived via "Reinvest →" from the Dashboard, location.state carries
  // reinvestAmount — the exact cash balance available to spend.
  const reinvestAmount = location.state?.reinvestAmount ?? null;

  // Returning-user state
  const isReturning = Boolean(riskProfile); // has a saved risk profile from the survey

  const [portfolios, setPortfolios]                     = useState([]);
  const [selectedPortfolioId, setSelectedPortfolioId]   = useState('');
  // persistedDefaultId: the starred default from the server — never changes on user click
  const [persistedDefaultId, setPersistedDefaultId]     = useState(null);
  // originalSurvey: locked-in survey values so the sublabel never changes after navigation
  const [originalSurvey, setOriginalSurvey]             = useState({ riskProfile: null, holdPeriodMonths: null });
  const [loadingPortfolios, setLoadingPortfolios]       = useState(false);
  const [cashBalance, setCashBalance]                   = useState(null);

  // frequency is now stored in AppContext — no local state needed

  // First-time flow state
  const [showIncome, setShowIncome]   = useState(false);
  const [error, setError]             = useState('');

  // Pre-fill amount when arriving from the Reinvest button on the Dashboard.
  // Runs once on mount; reinvestAmount is stable (derived from location.state).
  useEffect(() => {
    if (reinvestAmount != null) {
      setBudget((prev) => ({ ...prev, weeklyAmount: String(reinvestAmount) }));
    }
  }, []); // eslint-disable-line

  // Load portfolios + default for returning users.
  // Depends on isReturning so it fires both when the component first mounts
  // with riskProfile already set (SPA navigation) and when riskProfile arrives
  // asynchronously (page refresh). Because each navigation to /start unmounts
  // and remounts BudgetPage, this effect also re-runs on every visit, ensuring
  // portfolios created in Settings or elsewhere are always up to date.
  useEffect(() => {
    if (!isReturning) return;
    let cancelled = false;
    setLoadingPortfolios(true);
    Promise.all([
      api.getPortfolios(),
      api.getMe(localStorage.getItem('lg_auth_token')),
      api.getSurvey(),
      api.getHistory(),
    ])
      .then(([portRes, meRes, surveyRes, histRes]) => {
        if (cancelled) return;
        const list  = portRes.data.portfolios || [];
        const defId = meRes.data.user?.defaultPortfolioId || null;
        const survey = surveyRes.data?.survey;

        // Lock in the survey values so the Original Portfolio sublabel is stable
        if (survey) {
          setOriginalSurvey({ riskProfile: survey.riskProfile, holdPeriodMonths: survey.holdPeriodMonths });
        }

        // Store the persisted default — this never changes when the user clicks
        setPersistedDefaultId(defId);

        // Sort list so the default floats to the top
        const sorted = defId
          ? [...list.filter((p) => p.id === defId), ...list.filter((p) => p.id !== defId)]
          : list;
        setPortfolios(sorted);

        // Auto-select the persisted default on load
        if (defId) setSelectedPortfolioId(defId);

        // Cash balance
        setCashBalance(histRes.data.cashBalance ?? 0);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPortfolios(false); });
    return () => { cancelled = true; };
  }, [isReturning]); // eslint-disable-line

  // ── Returning user: proceed with selected portfolio ───────────────────────
  function handleReturningSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(budget.weeklyAmount);
    if (!amount || amount < 1) {
      setError('Please enter at least $1.');
      return;
    }
    if (reinvestAmount != null && amount > reinvestAmount) {
      setError(`You only have $${reinvestAmount.toFixed(2)} available to reinvest.`);
      return;
    }
    setError('');

    // Store the reinvest amount in context so ComparePage can pass it to the
    // backend when confirming the choice — the backend will deduct it from cash_balance.
    // Clear it when the user is investing fresh (not from cash balance).
    setReinvestAmount(reinvestAmount != null ? amount : null);

    // Record which portfolio drove the recommendations so ComparePage can
    // exclude it from the "Add to portfolio" dropdown (prevents double-adding).
    // selectedPortfolioId === '' means Original Portfolio was used.
    setActivePortfolioId(selectedPortfolioId === '' ? '' : (selectedPortfolioId || null));

    // If a named portfolio is selected, use its riskProfile and holdPeriodMonths
    if (selectedPortfolioId) {
      const p = portfolios.find((x) => x.id === selectedPortfolioId);
      if (p) {
        setRiskProfile(p.riskProfile);
        setHoldPeriodMonths(p.holdPeriodMonths);
      }
    }
    // Always go straight to compare — skip risk check for returning users
    navigate('/compare');
  }

  // ── First-time user: go to risk check ────────────────────────────────────
  function handleFirstTimeSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(budget.weeklyAmount);
    if (!amount || amount < 1) {
      setError('Please enter at least $1.');
      return;
    }
    setError('');
    navigate('/risk-check');
  }


  // ── Selected portfolio meta ───────────────────────────────────────────────
  // For the summary banner, never fall back to the mutable AppContext values.
  // Instead: if a named portfolio is selected use its data; if Original Portfolio
  // (id='') is selected use the locked-in originalSurvey values.
  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId);
  const summaryRisk = selectedPortfolio
    ? selectedPortfolio.riskProfile
    : (originalSurvey.riskProfile || riskProfile);
  const summaryHold = selectedPortfolio
    ? selectedPortfolio.holdPeriodMonths
    : (originalSurvey.holdPeriodMonths || holdPeriodMonths);
  const effectiveMeta = summaryRisk ? RISK_META[summaryRisk] : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURNING USER VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (isReturning) {
    return (
      <div>
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mb-3"><img src="/logo.png" alt="Liquid Gold" style={{ width: '3.5rem', height: '3.5rem', margin: '0 auto' }} /></div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            What do you want to invest?
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
            Choose a portfolio — it sets the risk and hold period automatically.
          </p>
        </div>

        {/* ── Cash balance chip (always visible when not in reinvest mode) ── */}
        {reinvestAmount == null && cashBalance !== null && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--low)44' }}
          >
            <span className="text-xl">💵</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--low)' }}>
                Cash balance
              </p>
              <p className="text-lg font-black" style={{ color: 'var(--low)' }}>
                ${cashBalance.toFixed(2)}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Available to reinvest · manage in Dashboard
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleReturningSubmit} className="space-y-5">

          {/* Reinvest mode: cash balance banner */}
          {reinvestAmount != null && (
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
            >
              <span className="text-2xl">💵</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--low)' }}>
                  Cash available to reinvest
                </p>
                <p className="text-xl font-black" style={{ color: 'var(--low)' }}>
                  ${reinvestAmount.toFixed(2)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  From your sold investments · enter up to this amount below
                </p>
              </div>
            </div>
          )}

          {/* Amount input */}
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Amount to invest
              </label>
              {reinvestAmount != null && (() => {
                const entered = parseFloat(budget.weeklyAmount) || 0;
                const remaining = reinvestAmount - entered;
                const over = entered > reinvestAmount;
                return (
                  <span className="text-xs font-semibold" style={{ color: over ? 'var(--high)' : 'var(--low)' }}>
                    {over
                      ? `$${(entered - reinvestAmount).toFixed(2)} over limit`
                      : `$${remaining.toFixed(2)} remaining`}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>$</span>
              <input
                type="number"
                min="1"
                max={reinvestAmount != null ? reinvestAmount : undefined}
                step="0.01"
                placeholder="25"
                value={budget.weeklyAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setBudget({ ...budget, weeklyAmount: val });
                }}
                className="w-full text-3xl font-bold outline-none pb-1 transition-colors bg-transparent"
                style={{ color: 'var(--text)', borderBottom: '2px solid var(--border)' }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--gold)')}
                onBlur={e  => (e.target.style.borderBottomColor = 'var(--border)')}
              />
            </div>
            {reinvestAmount != null && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {[0.25, 0.5, 0.75, 1].map((frac) => {
                  const v = +(reinvestAmount * frac).toFixed(2);
                  const label = frac === 1 ? 'All' : `${frac * 100}%`;
                  return (
                    <button
                      key={frac}
                      type="button"
                      onClick={() => setBudget({ ...budget, weeklyAmount: String(v) })}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={
                        parseFloat(budget.weeklyAmount) === v
                          ? { background: 'var(--low)', color: 'var(--bg)' }
                          : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }
                      }
                    >
                      {label} (${v})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment frequency */}
          <div className="card">
            <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
              How often?
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFrequency(opt.id)}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all"
                  style={
                    frequency === opt.id
                      ? { borderColor: 'var(--gold)', background: 'var(--gold-pale)', color: 'var(--gold)' }
                      : { borderColor: 'var(--border)', color: 'var(--muted)' }
                  }
                >
                  <span className="text-lg leading-none">{opt.emoji}</span>
                  <span className="text-[10px] font-semibold leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio picker */}
          <div className="card">
            <div className="mb-3">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Select a portfolio
              </label>
            </div>

            {loadingPortfolios ? (
              <div className="flex items-center gap-2 py-2" style={{ color: 'var(--muted)' }}>
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
                <span className="text-xs">Loading portfolios…</span>
              </div>
            ) : (
              (() => {
                // persistedDefaultId = what the server says is the user's default (loaded once)
                // selectedPortfolioId = what the user is currently hovering/picking (can change freely)
                // These are intentionally different — clicking never changes what "Default" badge shows.
                const defId = persistedDefaultId || '';

                const original = { id: '', name: 'Original Portfolio' };
                const all = [original, ...portfolios];

                // Order: persisted default first, everything else after
                const ordered = [
                  all.find(p => p.id === defId) || original,
                  ...all.filter(p => p.id !== defId),
                ];

                return (
                  <div className="space-y-2">
                    {ordered.map((p) => {
                      const isOriginal = p.id === '';
                      const meta = isOriginal ? null : (RISK_META[p.riskProfile] || RISK_META.balanced);
                      const sel  = selectedPortfolioId === p.id;
                      const isDefault = p.id === defId;

                      // For Original Portfolio: always use locked-in survey values, NOT the mutable context
                      const origRisk = originalSurvey.riskProfile || riskProfile;
                      const origHold = originalSurvey.holdPeriodMonths || holdPeriodMonths;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPortfolioId(p.id)}
                          className="w-full text-left rounded-xl px-4 py-3 flex items-center justify-between transition-all"
                          style={{
                            background: sel ? 'var(--gold-pale)' : 'var(--surface-2)',
                            border:     `2px solid ${sel ? 'var(--gold)' : 'var(--border)'}`,
                          }}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.name}</p>
                              {isDefault && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: 'var(--gold-pale)', color: 'var(--gold)', border: '1px solid var(--border)' }}>
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: 'var(--muted)' }}>
                              {isOriginal ? (
                                origRisk ? (
                                  <>
                                    <span style={{ color: RISK_META[origRisk]?.color }}>
                                      {RISK_META[origRisk]?.emoji} {origRisk}
                                    </span>
                                    {origHold ? ` · ${holdLabel(origHold)}` : ''}
                                  </>
                                ) : 'No risk profile set'
                              ) : (
                                <>
                                  <span style={{ color: meta.color }}>{meta.emoji} {meta.label}</span>
                                  {' · '}{holdLabel(p.holdPeriodMonths)}
                                </>
                              )}
                            </p>
                          </div>
                          {sel && <span style={{ color: 'var(--gold)', fontSize: 18 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Active profile summary */}
          {effectiveMeta && (
            <div
              className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: effectiveMeta.color + '1a', border: `1px solid ${effectiveMeta.color}44` }}
            >
              <span className="text-xl">{effectiveMeta.emoji}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: effectiveMeta.color }}>
                  {effectiveMeta.label} risk · {holdLabel(summaryHold)}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Recommendations will match this profile
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>}

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl font-bold text-base transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d' }}
          >
            See my options →
          </button>
        </form>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
          Nothing happens until you confirm. No money moves.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FIRST-TIME USER VIEW  (no riskProfile saved yet)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="text-4xl mb-3">🪙</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          Your money. Clearer options. Your choice.
        </h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
          Tell us how much you want to invest and how long you want to hold,
          and we'll find options that fit — no research needed.
        </p>
      </div>

      <form onSubmit={handleFirstTimeSubmit} className="space-y-6">
        {/* Amount */}
        <div className="card">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
            ① Amount to invest
          </label>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>$</span>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="25"
              value={budget.weeklyAmount}
              onChange={(e) => setBudget({ ...budget, weeklyAmount: e.target.value })}
              className="w-full text-3xl font-bold outline-none pb-1 transition-colors bg-transparent"
              style={{ color: 'var(--text)', borderBottom: '2px solid var(--border)' }}
              onFocus={e => (e.target.style.borderBottomColor = 'var(--gold)')}
              onBlur={e  => (e.target.style.borderBottomColor = 'var(--border)')}
            />
          </div>
          {!showIncome && (
            <button
              type="button"
              onClick={() => setShowIncome(true)}
              className="mt-3 text-xs hover:underline"
              style={{ color: '#3b82d4' }}
            >
              + Add income / assets (optional)
            </button>
          )}
          {showIncome && (
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                Monthly take-home income (optional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="2400"
                  value={budget.income}
                  onChange={(e) => setBudget({ ...budget, income: e.target.value })}
                  className="w-full text-base rounded-lg px-3 py-2 outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Payment frequency */}
        <div className="card">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
            ② How often will you invest?
          </label>
          <div className="grid grid-cols-5 gap-2">
            {FREQUENCY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFrequency(opt.id)}
                className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all"
                style={
                  frequency === opt.id
                    ? { borderColor: 'var(--gold)', background: 'var(--gold-pale)', color: 'var(--gold)' }
                    : { borderColor: 'var(--border)', color: 'var(--muted)' }
                }
              >
                <span className="text-lg leading-none">{opt.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Hold period */}
        <div className="card">
          <label className="block text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
            ③ How long do you want to hold?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {HOLD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setHoldPeriodMonths(opt.value)}
                className="py-2 px-3 rounded-xl text-sm font-medium border-2 transition-all"
                style={
                  holdPeriodMonths === opt.value
                    ? { borderColor: 'var(--gold)', background: 'var(--gold-pale)', color: 'var(--gold)' }
                    : { borderColor: 'var(--border)', color: 'var(--muted)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-3.5 rounded-2xl font-bold text-base transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d' }}
        >
          Next: Set your risk comfort →
        </button>
      </form>

      <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
        Nothing happens until you confirm. No money moves.
      </p>
    </div>
  );
}
