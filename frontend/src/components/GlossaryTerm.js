import React, { useState } from 'react';
import { api } from '../services/api';

export default function GlossaryTerm({ term, children }) {
  const [open, setOpen]       = useState(false);
  const [entry, setEntry]     = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleClick(e) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    try {
      const res = await api.lookupTerm(term);
      setEntry(res.data);
    } catch {
      setEntry({ term, definition: 'Definition not available.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span
        className="glossary-term"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick(e)}
      >
        {children || term}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="rounded-2xl p-6 max-w-sm mx-4 relative"
            style={{ background: '#152215', border: '1px solid #3a5a3a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-4 text-xl"
              style={{ color: '#7a9a7a' }}
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            {loading ? (
              <p className="text-sm" style={{ color: '#7a9a7a' }}>Loading…</p>
            ) : entry ? (
              <>
                <h3 className="font-bold text-base mb-2" style={{ color: '#f0b429' }}>
                  {entry.term}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#f0ede6' }}>
                  {entry.definition}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
