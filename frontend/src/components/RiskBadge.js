import React from 'react';

const COLORS = {
  low:    { bg: 'var(--bg-risk-low)',    text: 'var(--low)',    label: 'Safe'     },
  medium: { bg: 'var(--bg-risk-medium)', text: 'var(--medium)', label: 'Mixed'    },
  high:   { bg: 'var(--bg-risk-high)',   text: 'var(--high)',   label: 'Volatile' },
};

export default function RiskBadge({ level, className = '' }) {
  const c = COLORS[level] || COLORS.medium;
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}
