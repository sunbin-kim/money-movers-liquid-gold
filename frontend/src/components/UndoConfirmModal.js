import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

/**
 * UndoConfirmModal
 *
 * Props:
 *   title      — e.g. "Undo purchase"
 *   message    — description shown to the user
 *   onConfirm  — called after password is verified; receives no args
 *   onCancel   — called when user dismisses
 */
export default function UndoConfirmModal({ title, message, onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const inputRef = useRef(null);

  // Auto-focus the password field when the modal opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    setError('');
    try {
      await api.verifyPassword(password);
      onConfirm();
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      onClick={onCancel}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        background:     'rgba(0,0,0,0.55)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '1rem',
      }}
    >
      {/* Modal panel — stop click propagation so clicking inside doesn't close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: '1.25rem',
          padding:      '1.5rem',
          width:        '100%',
          maxWidth:     '360px',
          boxShadow:    '0 24px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--high)', margin: 0 }}>
            Confirm undo
          </p>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', margin: '0.25rem 0 0' }}>
            {title}
          </h2>
        </div>

        {/* Message */}
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.55, marginBottom: '1.1rem' }}>
          {message}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Password field */}
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: '0.35rem' }}>
            Enter your password to confirm
          </label>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{
              width:        '100%',
              boxSizing:    'border-box',
              background:   'var(--surface-2)',
              border:       `1px solid ${error ? 'var(--high)' : 'var(--border)'}`,
              borderRadius: '0.75rem',
              padding:      '0.6rem 0.85rem',
              fontSize:     '0.9rem',
              color:        'var(--text)',
              outline:      'none',
              marginBottom: '0.5rem',
              transition:   'border-color 0.15s',
            }}
            onFocus={e  => (e.target.style.borderColor = 'var(--gold)')}
            onBlur={e   => (e.target.style.borderColor = error ? 'var(--high)' : 'var(--border)')}
          />

          {error && (
            <p style={{ fontSize: '0.78rem', color: 'var(--high)', margin: '0 0 0.75rem' }}>{error}</p>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.9rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex:         1,
                padding:      '0.6rem',
                borderRadius: '0.75rem',
                fontWeight:   700,
                fontSize:     '0.82rem',
                background:   'var(--high)',
                color:        '#fff',
                border:       'none',
                cursor:       loading ? 'not-allowed' : 'pointer',
                opacity:      loading ? 0.6 : 1,
                transition:   'opacity 0.15s',
              }}
            >
              {loading ? 'Verifying…' : 'Confirm undo'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding:      '0.6rem 1rem',
                borderRadius: '0.75rem',
                fontWeight:   600,
                fontSize:     '0.82rem',
                background:   'transparent',
                color:        'var(--muted)',
                border:       '1px solid var(--border)',
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
