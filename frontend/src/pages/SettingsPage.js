import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuthContext';
import { useApp } from '../hooks/useAppContext';

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
};

const HOLD_OPTIONS = [
  { label: '1 month',  value: 1  },
  { label: '3 months', value: 3  },
  { label: '6 months', value: 6  },
  { label: '1 year',   value: 12 },
  { label: '2 years',  value: 24 },
  { label: '5+ years', value: 60 },
];

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative', emoji: '🛡️', color: '#4ade80' },
  { value: 'balanced',     label: 'Balanced',     emoji: '⚖️', color: '#fbbf24' },
  { value: 'aggressive',   label: 'Aggressive',   emoji: '🚀', color: '#f87171' },
];

const RISK_COLOR = Object.fromEntries(RISK_OPTIONS.map((r) => [r.value, r.color]));

function holdLabel(months) {
  if (!months) return '—';
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const y = Math.round(months / 12);
  return `${y} year${y > 1 ? 's' : ''}`;
}

// ── Inline edit form for a portfolio ─────────────────────────────────────────
function PortfolioEditForm({ portfolio, onSave, onCancel }) {
  const [name, setName]     = useState(portfolio.name);
  const [risk, setRisk]     = useState(portfolio.riskProfile);
  const [hold, setHold]     = useState(portfolio.holdPeriodMonths);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name cannot be empty.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.updatePortfolio(portfolio.id, {
        name: name.trim(), holdPeriodMonths: hold, riskProfile: risk,
      });
      onSave(res.data.portfolio);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-3 pt-3"
      style={{ borderTop: `1px solid ${C.border}` }}>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Risk profile</label>
        <div className="flex gap-2">
          {RISK_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setRisk(opt.value)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
              style={risk === opt.value ? { borderColor: opt.color, background: opt.color + '1a', color: opt.color } : { borderColor: C.border, color: C.muted }}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Hold period</label>
        <div className="grid grid-cols-3 gap-2">
          {HOLD_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setHold(opt.value)}
              className="py-1.5 rounded-xl text-xs font-medium border-2 transition-all"
              style={hold === opt.value ? { borderColor: C.gold, background: '#2a2000', color: C.gold } : { borderColor: C.border, color: C.muted }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: C.red }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-sm"
          style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: C.goldBtn, color: '#0d1a0d' }}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </form>
  );
}

// ── Portfolio row ─────────────────────────────────────────────────────────────
function PortfolioRow({ portfolio, isDefault, onUpdated, onSetDefault }) {
  const [editing, setEditing] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);
  const color = RISK_COLOR[portfolio.riskProfile] || C.muted;
  const riskOpt = RISK_OPTIONS.find(r => r.value === portfolio.riskProfile);

  async function handleSetDefault() {
    setSettingDefault(true);
    try {
      await api.setDefaultPortfolio(portfolio.id, !isDefault);
      onSetDefault(isDefault ? null : portfolio.id);
    } catch {}
    setSettingDefault(false);
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm" style={{ color: C.text }}>{portfolio.name}</p>
            {isDefault && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44` }}>
                Default
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            <span style={{ color }}>{riskOpt?.emoji} {portfolio.riskProfile}</span>
            {' · '}{holdLabel(portfolio.holdPeriodMonths)}
            {' · '}<span>Created {new Date(portfolio.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Star / default toggle */}
          <button
            onClick={handleSetDefault}
            disabled={settingDefault}
            title={isDefault ? 'Remove as default' : 'Set as default'}
            className="text-base leading-none disabled:opacity-40 transition-opacity"
            style={{ color: isDefault ? C.gold : C.border, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            {isDefault ? '★' : '☆'}
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={editing
              ? { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }
              : { background: 'transparent', color: C.gold, border: `1px solid ${C.gold}44` }
            }
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {editing && (
        <PortfolioEditForm
          portfolio={portfolio}
          onSave={(updated) => { onUpdated(updated); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── New portfolio form ────────────────────────────────────────────────────────
function NewPortfolioForm({ defaultRisk, onCreated, onCancel }) {
  const [name, setName]     = useState('');
  const [risk, setRisk]     = useState(defaultRisk || 'balanced');
  const [hold, setHold]     = useState(6);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a portfolio name.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.createPortfolio({ name: name.trim(), riskProfile: risk, holdPeriodMonths: hold });
      onCreated(res.data.portfolio);
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || 'Could not create portfolio.');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <p className="text-sm font-bold" style={{ color: C.text }}>New portfolio</p>
      <input type="text" placeholder="Portfolio name" value={name} onChange={(e) => setName(e.target.value)} autoFocus
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} />
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Risk profile</label>
        <div className="flex gap-2">
          {RISK_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setRisk(opt.value)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
              style={risk === opt.value ? { borderColor: opt.color, background: opt.color + '1a', color: opt.color } : { borderColor: C.border, color: C.muted }}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Hold period</label>
        <div className="grid grid-cols-3 gap-2">
          {HOLD_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setHold(opt.value)}
              className="py-1.5 rounded-xl text-xs font-medium border-2 transition-all"
              style={hold === opt.value ? { borderColor: C.gold, background: '#2a2000', color: C.gold } : { borderColor: C.border, color: C.muted }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs" style={{ color: C.red }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm"
          style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
          style={{ background: C.goldBtn, color: '#0d1a0d' }}>{saving ? 'Creating…' : 'Create portfolio'}</button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, login, logout }                                   = useAuth();
  const { riskProfile: contextProfile, openTutorial, theme, setTheme } = useApp();
  const navigate                        = useNavigate();

  // ── All hooks before any early return ────────────────────────────────────────
  const [survey, setSurvey]                   = useState(null);
  const [portfolios, setPortfolios]           = useState([]);
  const [defaultPortfolioId, setDefaultPortId] = useState(null);
  const [loadingData, setLoadingData]         = useState(true);
  const [showNewForm, setShowNewForm]         = useState(false);
  const [successMsg, setSuccessMsg]           = useState('');

  // Original Portfolio edit state
  const [editingOriginal, setEditingOriginal] = useState(false);
  const [origRisk, setOrigRisk]               = useState('');
  const [origHold, setOrigHold]               = useState(6);
  const [origSaving, setOrigSaving]           = useState(false);
  const [origError, setOrigError]             = useState('');

  // Delete account state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [delPassword, setDelPassword]             = useState('');
  const [delConfirm, setDelConfirm]               = useState('');
  const [deleting, setDeleting]                   = useState(false);
  const [delError, setDelError]                   = useState('');

  // Account info edit state
  const [editingAccount, setEditingAccount]   = useState(false);
  const [accName, setAccName]                 = useState('');
  const [accEmail, setAccEmail]               = useState('');
  const [accNewPw, setAccNewPw]               = useState('');
  const [accCurPw, setAccCurPw]               = useState('');
  const [accSaving, setAccSaving]             = useState(false);
  const [accError, setAccError]               = useState('');

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([api.getSurvey(), api.getPortfolios(), api.getMe(localStorage.getItem('lg_auth_token'))])
      .then(([surveyRes, portRes, meRes]) => {
        setSurvey(surveyRes.data.survey);
        setPortfolios(portRes.data.portfolios || []);
        const me = meRes.data.user;
        setDefaultPortId(me.defaultPortfolioId || null);
        setAccName(me.name || '');
        setAccEmail(me.email || '');
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, []);

  // Sync orig edit fields when survey loads
  useEffect(() => {
    if (survey) {
      setOrigRisk(survey.riskProfile || contextProfile || 'balanced');
      setOrigHold(survey.holdPeriodMonths || 6);
    }
  }, [survey, contextProfile]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleOriginalSave = useCallback(async (e) => {
    e.preventDefault();
    setOrigSaving(true); setOrigError('');
    try {
      await api.saveSurvey({ riskProfile: origRisk, holdPeriodMonths: origHold });
      setSurvey((prev) => ({ ...prev, riskProfile: origRisk, holdPeriodMonths: origHold }));
      setEditingOriginal(false);
      flash('Original Portfolio updated!');
    } catch { setOrigError('Could not save changes.'); }
    finally { setOrigSaving(false); }
  }, [origRisk, origHold]); // eslint-disable-line

  async function handleAccountSave(e) {
    e.preventDefault();
    setAccSaving(true); setAccError('');
    const payload = {};
    if (accName.trim() && accName.trim() !== user?.name) payload.name = accName.trim();
    if (accEmail.trim() && accEmail.trim() !== user?.email) payload.email = accEmail.trim();
    if (accNewPw) { payload.newPassword = accNewPw; payload.currentPassword = accCurPw; }

    if (Object.keys(payload).length === 0) {
      setEditingAccount(false); setAccSaving(false); return;
    }
    try {
      const res = await api.updateMe(payload);
      login({ token: localStorage.getItem('lg_auth_token'), user: res.data.user });
      setAccNewPw(''); setAccCurPw('');
      setEditingAccount(false);
      flash('Account updated!');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg;
      setAccError(msg || 'Could not update account.');
    } finally { setAccSaving(false); }
  }

  function handleUpdated(updated) {
    setPortfolios((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    flash('Changes saved!');
  }

  function handleCreated(portfolio) {
    setPortfolios((prev) => [...prev, portfolio]);
    setShowNewForm(false);
    flash('Portfolio created!');
  }

  function handleSetDefault(portfolioId) {
    setDefaultPortId(portfolioId);
  }

  function flash(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDelError('');
    if (delConfirm !== 'DELETE') {
      setDelError('Type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await api.deleteMe(delPassword);
      logout();
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg;
      setDelError(msg || 'Could not delete account. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-4 animate-spin"
          style={{ borderColor: C.gold, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const surveyRisk  = survey?.riskProfile || contextProfile;
  const surveyHold  = survey?.holdPeriodMonths;
  const surveyColor = surveyRisk ? RISK_COLOR[surveyRisk] : C.muted;

  // "Original Portfolio" is the default when no portfolio is set as default
  const originalIsDefault = !defaultPortfolioId;

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: C.text }}>⚙️ Settings</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          {user?.name ? `Hi ${user.name} · ` : ''}Manage your account and portfolios.
        </p>
      </div>

      {/* ── Account information ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            Account
          </p>
          <button
            onClick={() => { setEditingAccount((v) => !v); setAccError(''); }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={editingAccount
              ? { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }
              : { background: 'transparent', color: C.gold, border: `1px solid ${C.gold}44` }
            }
          >
            {editingAccount ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {!editingAccount ? (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: C.muted }}>Name</span>
              <span className="text-sm font-semibold" style={{ color: C.text }}>{user?.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: C.muted }}>Email</span>
              <span className="text-sm" style={{ color: C.text }}>{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: C.muted }}>Password</span>
              <span className="text-sm" style={{ color: C.muted }}>••••••••</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAccountSave} className="space-y-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Name</label>
              <input type="text" value={accName} onChange={(e) => setAccName(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
                autoFocus />
            </div>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Email</label>
              <input type="email" value={accEmail} onChange={(e) => setAccEmail(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            {/* New password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                New password <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span>
              </label>
              <input type="password" placeholder="New password" value={accNewPw} onChange={(e) => setAccNewPw(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            {/* Current password — only shown when new password is entered */}
            {accNewPw && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Current password</label>
                <input type="password" placeholder="Current password" value={accCurPw} onChange={(e) => setAccCurPw(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }} />
              </div>
            )}
            {accError && <p className="text-xs" style={{ color: C.red }}>{accError}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditingAccount(false)}
                className="flex-1 py-2 rounded-xl text-sm"
                style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
              <button type="submit" disabled={accSaving}
                className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: C.goldBtn, color: '#0d1a0d' }}>{accSaving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────────── */}
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.muted }}>
          Appearance
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>Theme</p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>Choose how the app looks</p>
          </div>
          <div className="flex gap-1.5">
            {['dark', 'light'].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold capitalize transition-colors"
                style={theme === t
                  ? { background: C.goldBtn, color: 'var(--bg)', border: '1px solid transparent' }
                  : { background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }
                }
              >
                {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Portfolio list ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            Portfolios
          </p>
          {!showNewForm && (
            <button onClick={() => setShowNewForm(true)}
              className="text-xs font-semibold hover:underline"
              style={{ color: C.gold }}>
              + New portfolio
            </button>
          )}
        </div>

        <p className="text-xs mb-3" style={{ color: C.muted }}>
          Tap ☆ to set a portfolio as your default — it will appear first on the Invest screen.
        </p>

        <div className="space-y-3">
          {/* Render default-first: if a named portfolio is the default it shows before Original Portfolio */}
          {defaultPortfolioId && portfolios.map((p) => p.id === defaultPortfolioId ? (
            <PortfolioRow
              key={p.id}
              portfolio={p}
              isDefault={true}
              onUpdated={handleUpdated}
              onSetDefault={handleSetDefault}
            />
          ) : null)}

          {/* Original Portfolio — shown first only when it IS the default */}
          {surveyRisk && (
            <div className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: C.text }}>Original Portfolio</p>
                    {originalIsDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44` }}>
                        Default
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: C.muted }}>From onboarding</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                    <span style={{ color: surveyColor }}>
                      {RISK_OPTIONS.find(r => r.value === surveyRisk)?.emoji} {surveyRisk}
                    </span>
                    {surveyHold ? ` · ${holdLabel(surveyHold)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Star toggle — sets defaultPortfolioId to null (meaning original) */}
                  <button
                    onClick={async () => {
                      if (!originalIsDefault && defaultPortfolioId) {
                        // Clear the current portfolio default → original becomes default
                        await api.setDefaultPortfolio(defaultPortfolioId, false);
                        setDefaultPortId(null);
                      }
                    }}
                    title={originalIsDefault ? 'Already the default' : 'Set as default'}
                    disabled={originalIsDefault}
                    className="text-base leading-none disabled:opacity-40"
                    style={{ color: originalIsDefault ? C.gold : C.border, background: 'none', border: 'none', cursor: originalIsDefault ? 'default' : 'pointer', padding: '4px' }}
                  >
                    {originalIsDefault ? '★' : '☆'}
                  </button>
                  <button
                    onClick={() => setEditingOriginal((v) => !v)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={editingOriginal
                      ? { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }
                      : { background: 'transparent', color: C.gold, border: `1px solid ${C.gold}44` }
                    }
                  >
                    {editingOriginal ? 'Cancel' : 'Edit'}
                  </button>
                </div>
              </div>

              {editingOriginal && (
                <form onSubmit={handleOriginalSave} className="space-y-3 mt-3 pt-3"
                  style={{ borderTop: `1px solid ${C.border}` }}>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Risk profile</label>
                    <div className="flex gap-2">
                      {RISK_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setOrigRisk(opt.value)}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                          style={origRisk === opt.value ? { borderColor: opt.color, background: opt.color + '1a', color: opt.color } : { borderColor: C.border, color: C.muted }}>
                          {opt.emoji} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Hold period</label>
                    <div className="grid grid-cols-3 gap-2">
                      {HOLD_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setOrigHold(opt.value)}
                          className="py-1.5 rounded-xl text-xs font-medium border-2 transition-all"
                          style={origHold === opt.value ? { borderColor: C.gold, background: '#2a2000', color: C.gold } : { borderColor: C.border, color: C.muted }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {origError && <p className="text-xs" style={{ color: C.red }}>{origError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingOriginal(false)}
                      className="flex-1 py-2 rounded-xl text-sm"
                      style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
                    <button type="submit" disabled={origSaving}
                      className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: C.goldBtn, color: '#0d1a0d' }}>{origSaving ? 'Saving…' : 'Save changes'}</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Remaining user-created portfolios (not the default, already rendered above) */}
          {portfolios.filter((p) => p.id !== defaultPortfolioId).map((p) => (
            <PortfolioRow
              key={p.id}
              portfolio={p}
              isDefault={false}
              onUpdated={handleUpdated}
              onSetDefault={handleSetDefault}
            />
          ))}

          {portfolios.length === 0 && !showNewForm && (
            <p className="text-sm text-center py-4" style={{ color: C.muted }}>
              No custom portfolios yet.{' '}
              <button onClick={() => setShowNewForm(true)}
                className="font-semibold hover:underline" style={{ color: C.gold }}>
                Create one →
              </button>
            </p>
          )}
        </div>

        {successMsg && (
          <p className="text-sm font-semibold mt-3 text-center" style={{ color: C.green }}>{successMsg}</p>
        )}
      </div>

      {/* ── New portfolio form ────────────────────────────────────────────────── */}
      {showNewForm && (
        <NewPortfolioForm
          defaultRisk={contextProfile || 'balanced'}
          onCreated={handleCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* ── Wallet ───────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative' }}>
        {/* Blurred content underneath */}
        <div style={{ filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
                Wallet
              </p>
              <span className="text-xs px-2.5 py-1 rounded-lg"
                style={{ background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}>
                Edit
              </span>
            </div>

            <div className="space-y-3">
              {/* Card number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                  Card number
                </label>
                <div className="w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
                  •••• •••• •••• 4242
                </div>
              </div>

              {/* Expiry + CVV row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                    Expiry
                  </label>
                  <div className="w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                    style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
                    MM / YY
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                    CVV
                  </label>
                  <div className="w-full rounded-xl px-3 py-2.5 text-sm font-mono"
                    style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
                    •••
                  </div>
                </div>
              </div>

              {/* Bank account */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
                  Linked bank account
                </label>
                <div className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}>
                  No account linked
                </div>
              </div>
            </div>

            <div className="w-full py-2.5 rounded-2xl text-sm font-bold text-center"
              style={{ background: C.goldBtn, color: '#0d1a0d' }}>
              Save payment details
            </div>
          </div>
        </div>

        {/* Coming soon overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10, borderRadius: '1rem',
            background: 'rgba(13,26,13,0.55)',
            backdropFilter: 'blur(1px)',
          }}
        >
          <span style={{ fontSize: 28 }}>💳</span>
          <p className="text-sm font-bold" style={{ color: C.text }}>Wallet</p>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}55`, letterSpacing: '0.06em' }}
          >
            Coming soon
          </span>
          <p className="text-xs text-center max-w-[180px]" style={{ color: C.muted }}>
            Link your payment details to fund investments directly.
          </p>
        </div>
      </div>

      {/* ── Tutorial ─────────────────────────────────────────────────────────── */}
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
          Help
        </p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: C.text }}>App tutorial</p>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>Replay the guided tour of every tab</p>
          </div>
          <button
            onClick={openTutorial}
            className="text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ background: C.goldBtn, color: 'var(--bg)' }}
          >
            View Tutorial
          </button>
        </div>
      </div>

      {/* ── Delete account ───────────────────────────────────────────────────── */}
      <div className="card" style={{ borderColor: C.red + '44' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: C.red }}>
          ⚠ Danger zone
        </p>

        {!showDeleteAccount ? (
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: C.red + '18', color: C.red, border: `1px solid ${C.red}44` }}
          >
            Delete account…
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-3">
            <p className="text-sm" style={{ color: C.text }}>
              This will permanently delete your account and all associated data. This cannot be undone.
            </p>

            <div>
              <label className="block text-xs mb-1" style={{ color: C.muted }}>Your password</label>
              <input
                type="password"
                value={delPassword}
                onChange={(e) => setDelPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: C.muted }}>
                Type <span style={{ color: C.red, fontWeight: 700 }}>DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                placeholder="DELETE"
                required
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
              />
            </div>

            {delError && (
              <p className="text-xs font-semibold" style={{ color: C.red }}>{delError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteAccount(false); setDelPassword(''); setDelConfirm(''); setDelError(''); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ color: C.muted, border: `1px solid ${C.border}` }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
