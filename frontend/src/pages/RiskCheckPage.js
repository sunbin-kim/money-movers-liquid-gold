import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useAppContext';

/**
 * Three quick questions that map to a risk profile.
 * Only shown for first-time users. Returning users (riskProfile already set)
 * are redirected back to /start (BudgetPage portfolio picker).
 */

const QUESTIONS = [
  {
    id: 'reaction',
    question: 'If your investment dropped 20% in a month, what would you do?',
    options: [
      { label: '😰 Sell everything – I can\'t handle losing money', value: 1 },
      { label: '😐 Hold and wait – I trust it comes back', value: 2 },
      { label: '😎 Buy more – this is a discount', value: 3 },
    ],
  },
  {
    id: 'goal',
    question: 'What matters most for this investment?',
    options: [
      { label: '🛡️ Keep my money safe above all', value: 1 },
      { label: '⚖️ Balance: some growth, some safety', value: 2 },
      { label: '🚀 Maximize growth, I can handle swings', value: 3 },
    ],
  },
  {
    id: 'experience',
    question: 'Have you invested before?',
    options: [
      { label: '❌ No – this is my first time', value: 1 },
      { label: '🔰 A little – I\'ve tried it once or twice', value: 2 },
      { label: '✅ Yes – I invest regularly', value: 3 },
    ],
  },
];

function scoreToProfile(total) {
  if (total <= 4) return 'conservative';
  if (total <= 7) return 'balanced';
  return 'aggressive';
}

const PROFILE_LABELS = {
  conservative: { emoji: '🛡️', label: 'Conservative', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  balanced: { emoji: '⚖️', label: 'Balanced', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  aggressive: { emoji: '🚀', label: 'Aggressive', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

export default function RiskCheckPage() {
  const navigate = useNavigate();
  const { riskProfile, setRiskProfile } = useApp();
  const [answers, setAnswers] = useState({});
  const [step, setStep]       = useState(0);
  const [done, setDone]       = useState(false);

  // Returning users already have a risk profile — send them to the portfolio
  // picker on /start rather than making them redo the quiz.
  useEffect(() => {
    if (riskProfile) {
      navigate('/start', { replace: true });
    }
  }, [riskProfile, navigate]);

  function pick(questionId, value) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      const profile = scoreToProfile(total);
      setRiskProfile(profile);
      setDone(true);
    }
  }

  function handleProceed() {
    navigate('/compare');
  }

  const q = QUESTIONS[step];
  const profile = done ? PROFILE_LABELS[riskProfile] : null;

  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 text-center"><img src="/logo.png" alt="Liquid Gold" style={{ width: '3.5rem', height: '3.5rem', margin: '0 auto' }} /></div>
        <h1 className="text-xl font-bold mt-1 text-center" style={{ color: 'var(--text)' }}>
          Quick risk check
        </h1>
        <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
          3 questions · sets your risk comfort · always editable
        </p>
      </div>

      {/* Progress dots */}
      {!done && (
        <div className="flex gap-2 mb-6">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all"
              style={{ background: i <= step ? 'var(--gold)' : 'var(--border)' }}
            />
          ))}
        </div>
      )}

      {!done ? (
        <div className="card">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--muted)' }}>
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--text)' }}>{q.question}</h2>
          <div className="space-y-3">
            {q.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => pick(q.id, opt.value)}
                className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--gold)';
                  e.currentTarget.style.background = 'var(--gold-pale)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = '';
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="card text-center py-8"
            style={{ borderColor: profile.color, background: profile.bg }}
          >
            <div className="text-4xl mb-2">{profile.emoji}</div>
            <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--muted)' }}>
              Your risk comfort
            </p>
            <h2 className="text-2xl font-bold" style={{ color: profile.color }}>
              {profile.label}
            </h2>
            <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
              {riskProfile === 'conservative' &&
                'We\'ll prioritize stability and protecting what you put in.'}
              {riskProfile === 'balanced' &&
                'We\'ll mix steady options with some growth potential.'}
              {riskProfile === 'aggressive' &&
                'We\'ll lean toward higher-growth options that may fluctuate more.'}
            </p>
          </div>

          <button
            onClick={() => { setDone(false); setStep(0); setAnswers({}); }}
            className="w-full py-2.5 rounded-xl border text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Retake quiz
          </button>

          <button
            onClick={handleProceed}
            className="w-full py-3.5 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d' }}
          >
            See my options →
          </button>
        </div>
      )}
    </div>
  );
}
