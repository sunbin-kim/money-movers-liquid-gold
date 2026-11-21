/**
 * SurveyGatePage.js
 *
 * First-time onboarding gate shown after login/register.
 * Asks the user how much they want to invest and on what schedule.
 * Saves the result to the backend and to AppContext, then sends
 * the user directly to /risk-check (skipping the separate BudgetPage).
 *
 * Returning users (survey already done) are redirected to /start immediately.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useApp } from '../hooks/useAppContext';
import { useAuth } from '../hooks/useAuthContext';

// ── Frequency options ─────────────────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  { id: 'instant',  label: 'One-time',    sublabel: 'Invest a lump sum right now',    emoji: '⚡' },
  { id: 'weekly',   label: 'Weekly',      sublabel: 'Set aside a little each week',   emoji: '📅' },
  { id: 'monthly',  label: 'Monthly',     sublabel: 'Invest once per month',          emoji: '🗓️' },
];

// ── Duration presets per frequency ───────────────────────────────────────────
const DURATION_OPTIONS = {
  instant: [
    { label: 'Short term',   sublabel: '~1 month',   months: 1  },
    { label: 'Medium term',  sublabel: '3–6 months', months: 3  },
    { label: 'Long term',    sublabel: '1+ years',   months: 12 },
  ],
  weekly: [
    { label: '1 month',   sublabel: '~4 payments',  months: 1  },
    { label: '3 months',  sublabel: '~13 payments', months: 3  },
    { label: '6 months',  sublabel: '~26 payments', months: 6  },
    { label: '1 year',    sublabel: '~52 payments', months: 12 },
    { label: '2 years',   sublabel: '~104 payments',months: 24 },
    { label: '5+ years',  sublabel: 'Long game',    months: 60 },
  ],
  monthly: [
    { label: '3 months',  sublabel: '3 payments',  months: 3  },
    { label: '6 months',  sublabel: '6 payments',  months: 6  },
    { label: '1 year',    sublabel: '12 payments', months: 12 },
    { label: '2 years',   sublabel: '24 payments', months: 24 },
    { label: '5+ years',  sublabel: 'Long game',   months: 60 },
  ],
};

// Weekly equivalent for display — instant shows total, others show per-period
function totalLabel(frequency, amount, months) {
  if (!amount || isNaN(amount) || amount <= 0) return null;
  const a = parseFloat(amount);
  if (frequency === 'instant') return `$${a.toFixed(0)} total`;
  if (frequency === 'weekly')  return `$${(a * 4.33 * months).toFixed(0)} total over ${months < 12 ? months + ' mo' : months / 12 + ' yr'}`;
  if (frequency === 'monthly') return `$${(a * months).toFixed(0)} total over ${months < 12 ? months + ' mo' : months / 12 + ' yr'}`;
  return null;
}

export default function SurveyGatePage() {
  const navigate = useNavigate();
  const { setBudget, setHoldPeriodMonths, riskProfile, setRiskProfile, surveyDone, setSurveyDone } = useApp();
  const { token } = useAuth();

  const [checking, setChecking]       = useState(true);
  const [step, setStep]               = useState(0); // 0 = frequency, 1 = amount, 2 = duration
  const [frequency, setFrequency]     = useState('weekly');
  const [amount, setAmount]           = useState('');
  const [months, setMonths]           = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // ── Check if user already did this ───────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    if (surveyDone === true) {
      navigate('/start', { replace: true });
      return;
    }

    if (surveyDone === false) {
      setChecking(false);
      return;
    }

    // surveyDone === null — AppContext hasn't resolved yet, hit API directly
    api.getSurvey()
      .then((res) => {
        const survey = res.data?.survey;
        if (survey) {
          // Hydrate context so BudgetPage sees isReturning = true immediately
          setRiskProfile(survey.riskProfile);
          setHoldPeriodMonths(survey.holdPeriodMonths);
          setSurveyDone(true);
          navigate('/start', { replace: true });
        } else {
          setSurveyDone(false);
          setChecking(false);
        }
      })
      .catch(() => {
        setSurveyDone(false);
        setChecking(false);
      });
  }, [surveyDone, token]); // eslint-disable-line

  // ── Proceed: save and go to risk check ───────────────────────────────────────
  async function handleProceed() {
    const a = parseFloat(amount);
    if (!a || a < 1) { setError('Please enter at least $1.'); return; }
    if (!months)     { setError('Please choose a duration.');  return; }
    setError('');
    setSaving(true);

    // Weekly equivalent stored in budget context
    const weeklyEquiv =
      frequency === 'weekly'  ? a :
      frequency === 'monthly' ? +(a / 4.33).toFixed(2) :
      +(a / months / 4.33).toFixed(2); // instant: spread over hold period

    try {
      // We reuse the survey endpoint to store hold period.
      // riskProfile will be set on the next screen (RiskCheckPage).
      await api.saveSurvey({ holdPeriodMonths: months, riskProfile: 'balanced' });
    } catch {
      // non-fatal — continue even if save fails
    }

    setBudget({ weeklyAmount: String(weeklyEquiv), income: '' });
    setHoldPeriodMonths(months);
    setSurveyDone(true);
    setSaving(false);
    navigate('/risk-check', { replace: true });
  }

  // ── Loading spinner ───────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 animate-spin"
          style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const durations = DURATION_OPTIONS[frequency];

  return (
    <div className="max-w-md mx-auto">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mb-3"><img src="/logo.png" alt="Liquid Gold" style={{ width: '3.5rem', height: '3.5rem', margin: '0 auto' }} /></div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
          Let's set up your investing plan
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Takes 30 seconds · nothing moves until you confirm
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['How often?', 'How much?', 'For how long?'].map((label, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: i < step ? 'var(--gold-pale)' : i === step ? 'var(--gold)' : 'var(--surface-2)',
                  color:      i < step ? 'var(--gold)' : i === step ? 'var(--bg)'  : 'var(--muted)',
                  border:     i < step ? '1px solid var(--gold)' : 'none',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs hidden sm:block" style={{ color: i === step ? 'var(--text)' : 'var(--muted)' }}>
                {label}
              </span>
            </div>
            {i < 2 && <div className="flex-1 h-px" style={{ background: i < step ? 'var(--gold)' : 'var(--border)' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 0: Frequency ─────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>How do you want to invest?</h2>
          {FREQUENCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setFrequency(opt.id); setMonths(null); setStep(1); }}
              className="w-full text-left rounded-2xl px-5 py-4 flex items-center gap-4 transition-all"
              style={{
                background:   frequency === opt.id ? 'var(--gold-pale)' : 'var(--surface)',
                border:       `2px solid ${frequency === opt.id ? 'var(--gold)' : 'var(--border)'}`,
              }}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{opt.label}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{opt.sublabel}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Step 1: Amount ────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
            How much do you want to invest{frequency === 'instant' ? '?' : frequency === 'weekly' ? ' per week?' : ' per month?'}
          </h2>
          <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>Enter the amount you're comfortable with</p>

          <div className="card mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold" style={{ color: 'var(--gold)' }}>$</span>
              <input
                type="number"
                min="1"
                step="1"
                autoFocus
                placeholder={frequency === 'instant' ? '500' : frequency === 'weekly' ? '25' : '100'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-4xl font-bold outline-none bg-transparent pb-1"
                style={{ color: 'var(--text)', borderBottom: '2px solid var(--border)' }}
                onFocus={e => (e.target.style.borderBottomColor = 'var(--gold)')}
                onBlur={e  => (e.target.style.borderBottomColor = 'var(--border)')}
              />
            </div>
            {/* Quick picks */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {(frequency === 'instant'
                ? ['100', '250', '500', '1000']
                : frequency === 'weekly'
                ? ['10', '25', '50', '100']
                : ['50', '100', '200', '500']
              ).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={
                    amount === v
                      ? { background: 'var(--gold)', color: 'var(--bg)' }
                      : { background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }
                  }
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm mb-4 text-center" style={{ color: '#f87171' }}>{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setError(''); setStep(0); }}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              ← Back
            </button>
            <button
              onClick={() => {
                const a = parseFloat(amount);
                if (!a || a < 1) { setError('Please enter at least $1.'); return; }
                setError('');
                setStep(2);
              }}
              className="flex-2 flex-grow py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Duration ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>For how long?</h2>
          <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>How long do you want to hold your investment?</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {durations.map((d) => (
              <button
                key={d.months}
                onClick={() => setMonths(d.months)}
                className="rounded-2xl px-4 py-4 text-left transition-all"
                style={{
                  background: months === d.months ? 'var(--gold-pale)' : 'var(--surface)',
                  border:     `2px solid ${months === d.months ? 'var(--gold)' : 'var(--border)'}`,
                }}
              >
                <p className="font-bold text-sm" style={{ color: months === d.months ? 'var(--gold)' : 'var(--text)' }}>
                  {d.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{d.sublabel}</p>
              </button>
            ))}
          </div>

          {/* Summary pill */}
          {months && (
            <div
              className="mb-5 rounded-xl px-4 py-3 text-center text-sm font-semibold"
              style={{ background: 'var(--gold-pale)', color: 'var(--gold)', border: '1px solid var(--border)' }}
            >
              {totalLabel(frequency, amount, months)}
            </div>
          )}

          {error && <p className="text-sm mb-4 text-center" style={{ color: '#f87171' }}>{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => { setError(''); setStep(1); }}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              ← Back
            </button>
            <button
              onClick={handleProceed}
              disabled={saving || !months}
              className="flex-grow py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d' }}
            >
              {saving ? 'Saving…' : "Let's invest →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
