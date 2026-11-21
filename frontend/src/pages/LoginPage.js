import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuthContext';
import { useApp } from '../hooks/useAppContext';

const C = {
  bg:      'var(--bg)',
  surface: 'var(--surface)',
  border:  'var(--border)',
  gold:    'var(--gold)',
  text:    'var(--text)',
  muted:   'var(--muted)',
  btn:     'linear-gradient(135deg,#c98a00,#f0b429)',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { resetAppForNewSession } = useApp();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email: form.email, password: form.password });
      login(res.data);
      resetAppForNewSession();
      navigate('/survey-gate', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto pt-4">
      <div className="text-center mb-8">
        <div className="mb-3"><img src="/logo.png" alt="Liquid Gold" style={{ width: '3.5rem', height: '3.5rem', margin: '0 auto' }} /></div>
        <h1 className="text-2xl font-bold" style={{ color: C.text }}>Welcome back</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>Log in to your Liquid Gold account</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-2)', color: C.text, border: `1px solid ${C.border}` }}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-2)', color: C.text, border: `1px solid ${C.border}` }}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: C.btn, color: '#0d1a0d' }}
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="text-center text-sm mt-5" style={{ color: C.muted }}>
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold hover:underline" style={{ color: C.gold }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
