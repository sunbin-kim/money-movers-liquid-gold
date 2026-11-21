import React, { useEffect, useState } from 'react';
import { useApp } from '../hooks/useAppContext';

/**
 * SplashScreen — shown once per browser session on first app load.
 * Plays a ~2.4 s animation then fades out, calling onDone() so the
 * parent can unmount it entirely.
 */
export default function SplashScreen({ onDone }) {
  const { theme } = useApp();
  // Phase: 'in' → 'hold' → 'out' → done
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    // logo + name fade in: 0.7s
    // hold visible: 0.9s
    // fade out: 0.6s
    const hold  = setTimeout(() => setPhase('out'),  1600);
    const done  = setTimeout(() => onDone(),          2200);
    return () => { clearTimeout(hold); clearTimeout(done); };
  }, [onDone]);

  const fading = phase === 'out';

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'var(--bg)',
        transition:      'opacity 0.6s ease',
        opacity:         fading ? 0 : 1,
        pointerEvents:   fading ? 'none' : 'all',
      }}
    >
      {/* Logo */}
      <div style={{
        animation: 'splashLogoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
        marginBottom: '1.25rem',
      }}>
        <img
          src="/logo.png"
          alt="Liquid Gold"
          style={{ width: '88px', height: '88px' }}
        />
      </div>

      {/* App name */}
      <div style={{
        animation: 'splashTextIn 0.6s ease 0.3s both',
      }}>
        <p style={{
          fontSize:    '2rem',
          fontWeight:  800,
          letterSpacing: '-0.02em',
          color:       'var(--gold)',
          fontFamily:  '-apple-system, "Segoe UI", system-ui, sans-serif',
          margin:      0,
          lineHeight:  1.1,
          textAlign:   'center',
        }}>
          Liquid Gold
        </p>
      </div>

      {/* Tagline */}
      <div style={{
        animation: 'splashTextIn 0.6s ease 0.55s both',
        marginTop: '0.85rem',
        padding:   '0 1.5rem',
      }}>
        <p style={{
          fontSize:   '0.82rem',
          color:      'var(--muted)',
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          margin:     0,
          lineHeight: 1.6,
          textAlign:  'center',
          maxWidth:   '260px',
        }}>
          Your money. Clearer options. Your choice.
          <br />
          <span style={{ color: 'var(--muted)', opacity: 0.75 }}>Investing made easy for beginners.</span>
        </p>
      </div>

      {/* Gold accent bar */}
      <div style={{
        animation:    'splashBarIn 0.5s ease 0.75s both',
        marginTop:    '2rem',
        height:       '3px',
        width:        '48px',
        borderRadius: '99px',
        background:   'linear-gradient(90deg, #c98a00, #f0b429)',
      }} />

      <style>{`
        @keyframes splashLogoIn {
          from { opacity: 0; transform: scale(0.6) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes splashTextIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashBarIn {
          from { opacity: 0; transform: scaleX(0); }
          to   { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
