import React, { useState, useEffect, useCallback, useRef } from 'react';

const STEPS = [
  {
    tab:     'Invest',
    emoji:   '\u{1F4B0}',
    title:   'Invest tab',
    desc:    "Tell us how much you want to invest and pick a portfolio. We'll recommend the best-fit options for your risk level and hold period.",
    details: ['Choose weekly, monthly, or one-time investment', 'Select from your portfolios', 'Tap "See my options" to get personalised picks'],
    color:   '#f0b429',
  },
  {
    tab:     'Browse',
    emoji:   '\u{1F50D}',
    title:   'Browse tab',
    desc:    'Explore all available stocks and ETFs. Filter by risk level or type to find investments that match your style.',
    details: ['Filter by Safe / Mixed / Volatile', 'Filter by ETF, Stock, or Other', 'Tap any card to see more detail'],
    color:   '#60a5fa',
  },
  {
    tab:     'Dashboard',
    emoji:   '\u{1F4CA}',
    title:   'Dashboard tab',
    desc:    'Track your portfolio performance, estimated values, and transaction history all in one place.',
    details: ['Expand any holding to see its price chart', 'Buy more or sell directly from here', 'Use Undo if you made a mistake'],
    color:   '#34d399',
  },
  {
    tab:     'Friends',
    emoji:   '\u{1F465}',
    title:   'Friends tab',
    desc:    "See how you compare with friends, send investment challenges, and even shadow a friend's portfolio.",
    details: ['Leaderboard shows portfolio growth ranking', 'Send friend requests by username', 'Shadow: mirror a friend investment automatically'],
    color:   '#f472b6',
  },
  {
    tab:     'Trophies',
    emoji:   '\u{1F3C6}',
    title:   'Trophies tab',
    desc:    'Earn awards as you invest — from your first purchase all the way to legendary long-term holds.',
    details: ['Trophies unlock automatically as you hit milestones', 'Each portfolio has its own trophy shelf', 'Share your achievements with friends'],
    color:   '#fbbf24',
  },
  {
    tab:     'Settings',
    emoji:   '\u2699\uFE0F',
    title:   'Settings tab',
    desc:    'Manage your account, adjust your risk profile, create new portfolios, and revisit this tutorial anytime.',
    details: ['Edit your username, email, or password', 'Create and manage multiple portfolios', 'Tap "View Tutorial" to replay this guide'],
    color:   '#94a3b8',
  },
];

const PAD = 6; // px padding around the spotlight target

function useTargetRect(tab) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    function measure() {
      const el = document.querySelector(`[data-tutorial="${tab}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    }
    // Small delay so the DOM has settled
    const t = setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [tab]);

  return rect;
}

export default function TutorialOverlay({ onClose }) {
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState('in');
  const [visible, setVisible] = useState(false);
  const bubbleRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const total = STEPS.length;
  const current = STEPS[step];
  const rect = useTargetRect(current.tab);

  const goTo = useCallback((next) => {
    if (next < 0 || next >= total) return;
    const dir = next > step ? 'out-left' : 'out-right';
    setAnimDir(dir);
    setTimeout(() => {
      setStep(next);
      setAnimDir('in');
    }, 180);
  }, [step, total]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') goTo(step + 1);
      if (e.key === 'ArrowLeft')  goTo(step - 1);
      if (e.key === 'Escape')     handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goTo]); // eslint-disable-line

  // ── Spotlight geometry ──────────────────────────────────────────────────
  const spotlight = rect ? {
    top:    rect.top    - PAD,
    left:   rect.left   - PAD,
    width:  rect.width  + PAD * 2,
    height: rect.height + PAD * 2,
  } : null;

  // Build an SVG mask path: full-screen rect minus the spotlight cutout
  const W = window.innerWidth;
  const H = window.innerHeight;

  const maskPath = spotlight
    ? `M0 0 H${W} V${H} H0 Z ` +
      `M${spotlight.left} ${spotlight.top} ` +
      `H${spotlight.left + spotlight.width} ` +
      `V${spotlight.top + spotlight.height} ` +
      `H${spotlight.left} Z`
    : `M0 0 H${W} V${H} H0 Z`;

  // ── Speech bubble position ──────────────────────────────────────────────
  // Bubble appears below the spotlight cutout
  const BUBBLE_WIDTH = 300;
  const BUBBLE_MARGIN = 8; // gap between spotlight and bubble
  const POINTER_H = 10;    // triangle pointer height

  let bubbleLeft = spotlight
    ? Math.max(8, Math.min(
        W - BUBBLE_WIDTH - 8,
        spotlight.left + spotlight.width / 2 - BUBBLE_WIDTH / 2,
      ))
    : (W - BUBBLE_WIDTH) / 2;

  let bubbleTop = spotlight
    ? spotlight.top + spotlight.height + BUBBLE_MARGIN + POINTER_H
    : H / 2 - 160;

  // If bubble would go off-screen bottom, flip it above the spotlight
  const flipAbove = spotlight && bubbleTop + 320 > H - 16;
  if (flipAbove && spotlight) {
    bubbleTop = spotlight.top - BUBBLE_MARGIN - POINTER_H - 10; // 10 = approx bubble will grow up
  }

  // Triangle pointer x (centred on the spotlight)
  const pointerX = spotlight
    ? Math.max(16, Math.min(
        BUBBLE_WIDTH - 24,
        spotlight.left + spotlight.width / 2 - bubbleLeft,
      ))
    : BUBBLE_WIDTH / 2;

  // ── Slide animation ─────────────────────────────────────────────────────
  const slideStyle = {
    transition: 'opacity 0.18s ease, transform 0.18s ease',
    opacity:    animDir === 'in' ? 1 : 0,
    transform:  animDir === 'in'       ? 'translateX(0)'
              : animDir === 'out-left' ? 'translateX(-16px)'
              : 'translateX(16px)',
  };

  return (
    <div
      style={{
        position:     'fixed',
        inset:        0,
        zIndex:       2000,
        transition:   'opacity 0.3s ease',
        opacity:      visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
      }}
      onClick={handleClose}
    >
      {/* ── Dark overlay with spotlight cutout ── */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="tut-mask">
            <path d={maskPath} fill="white" fillRule="evenodd" />
          </mask>
        </defs>
        <rect width={W} height={H} fill="rgba(0,0,0,0.72)" mask="url(#tut-mask)" />
        {/* Glowing ring around spotlight */}
        {spotlight && (
          <rect
            x={spotlight.left - 1}
            y={spotlight.top  - 1}
            width={spotlight.width  + 2}
            height={spotlight.height + 2}
            rx="10"
            fill="none"
            stroke={current.color}
            strokeWidth="2"
            opacity="0.9"
          />
        )}
      </svg>

      {/* ── Speech bubble ── */}
      <div
        ref={bubbleRef}
        onClick={e => e.stopPropagation()}
        style={{
          position:     'fixed',
          top:          bubbleTop,
          left:         bubbleLeft,
          width:        BUBBLE_WIDTH,
          background:   'var(--surface)',
          border:       `1px solid ${current.color}55`,
          borderRadius: '1rem',
          boxShadow:    `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${current.color}22`,
          overflow:     'visible',
          zIndex:       2001,
          ...slideStyle,
        }}
      >
        {/* Triangle pointer */}
        {spotlight && !flipAbove && (
          <div style={{
            position:    'absolute',
            top:         -(POINTER_H),
            left:        pointerX - 8,
            width:       0,
            height:      0,
            borderLeft:  '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: `${POINTER_H}px solid ${current.color}55`,
          }} />
        )}
        {spotlight && !flipAbove && (
          <div style={{
            position:    'absolute',
            top:         -(POINTER_H - 1),
            left:        pointerX - 7,
            width:       0,
            height:      0,
            borderLeft:  '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: `${POINTER_H - 1}px solid var(--surface)`,
          }} />
        )}
        {/* Flipped pointer (above bubble → pointing down) */}
        {spotlight && flipAbove && (
          <div style={{
            position:   'absolute',
            bottom:     -(POINTER_H),
            left:       pointerX - 8,
            width:      0,
            height:     0,
            borderLeft: '8px solid transparent',
            borderRight:'8px solid transparent',
            borderTop:  `${POINTER_H}px solid ${current.color}55`,
          }} />
        )}
        {spotlight && flipAbove && (
          <div style={{
            position:   'absolute',
            bottom:     -(POINTER_H - 1),
            left:       pointerX - 7,
            width:      0,
            height:     0,
            borderLeft: '7px solid transparent',
            borderRight:'7px solid transparent',
            borderTop:  `${POINTER_H - 1}px solid var(--surface)`,
          }} />
        )}

        {/* Colour accent bar */}
        <div style={{ height: '3px', background: `linear-gradient(90deg, ${current.color}88, ${current.color})`, borderRadius: '1rem 1rem 0 0' }} />

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', padding: '0.75rem 1.25rem 0' }}>
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width:        i === step ? '16px' : '6px',
                height:       '6px',
                borderRadius: '99px',
                background:   i === step ? current.color : 'var(--border-2)',
                border:       'none',
                cursor:       'pointer',
                transition:   'all 0.25s ease',
                padding:      0,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '0.75rem 1.1rem 0' }}>
          {/* Emoji + title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{
              fontSize:     '1.6rem',
              lineHeight:   1,
              background:   current.color + '22',
              borderRadius: '0.6rem',
              padding:      '0.3rem 0.35rem',
            }}>
              {current.emoji}
            </span>
            <div>
              <p style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: current.color, margin: 0 }}>
                {current.tab}
              </p>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                {current.title}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55, marginBottom: '0.6rem' }}>
            {current.desc}
          </p>

          {/* Detail bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
            {current.details.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                <span style={{ color: current.color, fontWeight: 700, fontSize: '0.65rem', marginTop: '2px', flexShrink: 0 }}>✦</span>
                <p style={{ fontSize: '0.76rem', color: 'var(--text)', margin: 0, lineHeight: 1.45 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0.6rem 1.1rem 0.9rem',
          borderTop:      '1px solid var(--border)',
        }}>
          <button
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            style={{
              padding:      '0.4rem 0.85rem',
              borderRadius: '0.65rem',
              fontSize:     '0.75rem',
              fontWeight:   600,
              color:        step === 0 ? 'var(--border-2)' : 'var(--muted)',
              background:   'transparent',
              border:       `1px solid ${step === 0 ? 'var(--border)' : 'var(--border-2)'}`,
              cursor:       step === 0 ? 'default' : 'pointer',
            }}
          >
            ← Back
          </button>

          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {step + 1} / {total}
          </span>

          {step < total - 1 ? (
            <button
              onClick={() => goTo(step + 1)}
              style={{
                padding:      '0.4rem 0.9rem',
                borderRadius: '0.65rem',
                fontSize:     '0.75rem',
                fontWeight:   700,
                color:        'var(--bg)',
                background:   current.color,
                border:       'none',
                cursor:       'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleClose}
              style={{
                padding:      '0.4rem 0.9rem',
                borderRadius: '0.65rem',
                fontSize:     '0.75rem',
                fontWeight:   700,
                color:        '#0d1a0d',
                background:   'linear-gradient(135deg,#c98a00,#f0b429)',
                border:       'none',
                cursor:       'pointer',
              }}
            >
              Let's go! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
