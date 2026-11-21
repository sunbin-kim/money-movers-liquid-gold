/**
 * FriendsPage.js — Social hub.
 *
 * Tabs:
 *  1. Leaderboard  – ranked portfolio growth vs friends
 *  2. Friends      – accepted friends, pending requests, add new
 *  3. Shadow       – your mirror/copy investments
 */

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuthContext';
import RiskBadge from '../components/RiskBadge';
import AwardsPage from './AwardsPage';

// ── Design tokens (matches the rest of the app) ───────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-8 h-8 rounded-full border-4 animate-spin"
        style={{ borderColor: C.gold, borderTopColor: 'transparent' }}
      />
    </div>
  );
}

function ErrorMsg({ msg }) {
  if (!msg) return null;
  return (
    <p className="text-sm px-3 py-2 rounded-lg" style={{ color: C.red, background: 'rgba(248,113,113,0.1)' }}>
      {msg}
    </p>
  );
}

function SuccessMsg({ msg }) {
  if (!msg) return null;
  return (
    <p className="text-sm px-3 py-2 rounded-lg" style={{ color: C.green, background: 'rgba(74,222,128,0.1)' }}>
      {msg}
    </p>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = ['Leaderboard', 'Friends', 'Shadow', 'Trophies'];

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState('Leaderboard');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: C.text }}>👥 Friends & Competition</h1>
        <p className="text-sm" style={{ color: C.muted }}>
          Compare growth, challenge friends, and mirror their best moves.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.surface }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors"
            style={
              activeTab === tab
                ? { background: C.surface2, color: C.gold, border: `1px solid ${C.border}` }
                : { color: C.muted, border: '1px solid transparent' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Leaderboard' && <LeaderboardTab />}
      {activeTab === 'Friends'     && <FriendsTab />}
      {activeTab === 'Shadow'      && <ShadowTab />}
      {activeTab === 'Trophies'    && <TrophiesTab />}
    </div>
  );
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────
function LeaderboardTab() {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard();
      setBoard(res.data.leaderboard);
    } catch {
      setBoard([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;
  if (!board || board.length === 0) {
    return (
      <div className="card text-center py-10" style={{ color: C.muted }}>
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-semibold" style={{ color: C.text }}>No friends yet</p>
        <p className="text-sm mt-1">Add friends to start competing on the leaderboard.</p>
      </div>
    );
  }

  const leader = board[0];
  const maxChange = Math.max(...board.map((e) => Math.abs(e.changePercent)), 1);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        🏆 Portfolio growth ranking
      </p>

      {board.map((entry, idx) => {
        const isFirst = idx === 0;
        const gain    = entry.changePercent >= 0;
        const barPct  = Math.round((Math.abs(entry.changePercent) / maxChange) * 100);
        const medal   = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

        return (
          <div
            key={entry.userId}
            className="card"
            style={isFirst ? { borderColor: C.gold } : {}}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{medal}</span>
                <div>
                  <span className="text-sm font-bold" style={{ color: entry.isSelf ? C.gold : C.text }}>
                    {entry.name}{entry.isSelf ? ' (you)' : ''}
                  </span>
                  <p className="text-xs" style={{ color: C.muted }}>
                    ${entry.totalInvested.toFixed(0)} invested · {entry.entries} move{entry.entries !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className="text-lg font-bold"
                  style={{ color: gain ? C.green : C.red }}
                >
                  {gain ? '+' : ''}{entry.changePercent}%
                </p>
                <p className="text-xs" style={{ color: C.muted }}>
                  ${entry.currentValue.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Growth bar */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, background: gain ? C.green : C.red }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Friends tab ───────────────────────────────────────────────────────────────
// ── Inline friend card with expandable portfolio panel ────────────────────────
function FriendCard({ f, onRemove, onFlash, portfolios }) {
  const [expanded,  setExpanded]  = useState(false);
  const [history,   setHistory]   = useState(null);
  const [portLoad,  setPortLoad]  = useState(false);

  async function loadPortfolio() {
    if (history !== null) { setExpanded(v => !v); return; }
    setExpanded(true);
    setPortLoad(true);
    try {
      const res = await api.getFriendPortfolio(f.friendId);
      setHistory(res.data.history || []);
    } catch { setHistory([]); }
    finally { setPortLoad(false); }
  }

  const totalInvested = history ? history.reduce((s, e) => s + (e.amount || 0), 0) : 0;
  const activeCount   = history ? history.filter(e => !e.sold).length : 0;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Summary row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: C.gold + '22', color: C.gold }}>
            {f.friendName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: C.text }}>@{f.friendName}</p>
            {history && (
              <p className="text-[10px]" style={{ color: C.muted }}>
                {activeCount} active position{activeCount !== 1 ? 's' : ''} · ${totalInvested.toFixed(0)} invested
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadPortfolio}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ background: expanded ? C.gold + '22' : C.surface2, color: C.gold, border: `1px solid ${C.gold}44` }}
          >
            {expanded ? 'Hide ▲' : 'Portfolio ▼'}
          </button>
          <button onClick={() => onRemove(f.friendId)} className="text-xs px-2 py-1.5 rounded-lg"
            style={{ color: C.muted, border: `1px solid ${C.border}` }}>
            ✕
          </button>
        </div>
      </div>

      {/* Expanded portfolio panel */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {portLoad ? (
            <div className="px-4 py-6 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: C.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="px-4 py-4 text-sm text-center" style={{ color: C.muted }}>
              No investment history yet.
            </p>
          ) : (
            <FriendPortfolioPanel
              friend={f}
              history={history}
              portfolios={portfolios}
              onFlash={onFlash}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FriendsTab() {
  const { user } = useAuth();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [portfolios, setPortfolios] = useState([]);

  const [searchQ, setSearchQ]     = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback]   = useState({ err: '', ok: '' });

  const flash = (err, ok) => {
    setFeedback({ err: err || '', ok: ok || '' });
    setTimeout(() => setFeedback({ err: '', ok: '' }), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [friendsRes, portRes] = await Promise.all([
        api.getFriends(),
        api.getPortfolios(),
      ]);
      setData(friendsRes.data);
      setPortfolios(portRes.data.portfolios || []);
    } catch {
      setData({ friends: [], pending: [], sent: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchUsers(searchQ.trim());
      setSearchRes(res.data.users || []);
    } catch { setSearchRes([]); }
    finally { setSearching(false); }
  }

  async function sendRequest(addresseeId) {
    try {
      await api.sendFriendRequest(addresseeId);
      flash('', 'Friend request sent!');
      setSearchRes([]); setSearchQ('');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Could not send request.', ''); }
  }

  async function respond(id, accept) {
    try {
      await api.respondToFriendRequest(id, accept);
      flash('', accept ? 'Friend added!' : 'Request declined.');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Error.', ''); }
  }

  async function removeFriend(friendId) {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await api.removeFriend(friendId);
      flash('', 'Friend removed.');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Error.', ''); }
  }

  if (loading) return <Spinner />;
  const { friends = [], pending = [], sent = [] } = data || {};

  return (
    <div className="space-y-6">
      <ErrorMsg msg={feedback.err} />
      <SuccessMsg msg={feedback.ok} />

      {/* Add friend search */}
      <div className="card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          ➕ Add a friend
        </p>
        <form onSubmit={doSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Search by username or email…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
          />
          <button type="submit" disabled={searching}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: C.goldBtn, color: '#0d1a0d' }}>
            {searching ? '…' : 'Search'}
          </button>
        </form>
        {searchRes.length > 0 && (
          <ul className="space-y-2">
            {searchRes.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                style={{ background: C.surface2, border: `1px solid ${C.border}` }}>
                <p className="text-sm font-semibold" style={{ color: C.text }}>@{u.name}</p>
                {u.id !== user?.id && (
                  <button onClick={() => sendRequest(u.id)}
                    className="text-xs px-3 py-1 rounded-lg font-semibold"
                    style={{ background: C.goldBtn, color: '#0d1a0d' }}>
                    Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {searchRes.length === 0 && searchQ && !searching && (
          <p className="text-xs" style={{ color: C.muted }}>No users found.</p>
        )}
      </div>

      {/* Incoming requests */}
      {pending.length > 0 && (
        <div className="card space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            📬 Incoming requests ({pending.length})
          </p>
          {pending.map((req) => (
            <div key={req.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: C.text }}>@{req.requesterName}</p>
                <p className="text-xs" style={{ color: C.muted }}>wants to be your friend</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => respond(req.id, true)}
                  className="text-xs px-3 py-1 rounded-lg font-semibold"
                  style={{ background: C.goldBtn, color: '#0d1a0d' }}>
                  Accept
                </button>
                <button onClick={() => respond(req.id, false)}
                  className="text-xs px-3 py-1 rounded-lg font-semibold"
                  style={{ border: `1px solid ${C.border}`, color: C.muted }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent requests */}
      {sent.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
            📤 Sent requests
          </p>
          {sent.map((req) => (
            <div key={req.id} className="flex items-center justify-between">
              <p className="text-sm" style={{ color: C.text }}>@{req.addresseeName}</p>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                Pending
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          🤝 Your friends ({friends.length})
        </p>
        {friends.length === 0 ? (
          <div className="card text-center py-8" style={{ color: C.muted }}>
            <p>No friends yet. Search above to add someone!</p>
          </div>
        ) : (
          friends.map((f) => (
            <FriendCard key={f.friendshipId} f={f} onRemove={removeFriend} onFlash={flash} portfolios={portfolios} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Friend portfolio panel (inline, no overlay) ───────────────────────────────
const SHADOW_FREQS = [
  { id: 'one-time', label: 'One Time' },
  { id: 'daily',   label: 'Daily'    },
  { id: 'weekly',  label: 'Weekly'   },
  { id: 'monthly', label: 'Monthly'  },
  { id: 'yearly',  label: 'Yearly'   },
];

function FriendPortfolioPanel({ friend, history, portfolios, onFlash }) {
  const [shadowTarget,    setShadowTarget]    = useState('portfolio'); // 'portfolio' | entry.id
  const [shadowAmount,    setShadowAmount]    = useState('');
  const [shadowFreq,      setShadowFreq]      = useState('one-time');
  const [shadowPortfolio, setShadowPortfolio] = useState(''); // '' = Original Portfolio
  const [submitting,      setSubmitting]      = useState(false);

  const totalInvested = history.reduce((s, e) => s + (e.amount || 0), 0);
  const activeHistory = history.filter(e => !e.sold);

  async function doShadow() {
    const amount = parseFloat(shadowAmount);
    if (!amount || amount < 1) { onFlash('Enter at least $1.', ''); return; }
    setSubmitting(true);
    try {
      const isPortfolio = shadowTarget === 'portfolio';
      await api.createShadowInvestment({
        friendId:    friend.friendId,
        targetType:  isPortfolio ? 'portfolio' : 'entry',
        targetId:    isPortfolio ? friend.friendId : shadowTarget,
        amount,
        frequency:   shadowFreq,
        portfolioId: shadowPortfolio || undefined,
      });
      const targetEntry = history.find(e => e.id === shadowTarget);
      onFlash('', isPortfolio
        ? `Now mirroring @${friend.friendName}'s entire portfolio!`
        : `Now shadowing "${targetEntry?.optionName}"!`
      );
      setShadowAmount('');
    } catch (err) {
      onFlash(err.response?.data?.error || 'Could not create shadow investment.', '');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 pb-4 space-y-4 pt-3">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2" style={{ background: C.surface2 }}>
          <p className="text-[10px]" style={{ color: C.muted }}>Total invested</p>
          <p className="text-base font-bold" style={{ color: C.text }}>${totalInvested.toFixed(0)}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: C.surface2 }}>
          <p className="text-[10px]" style={{ color: C.muted }}>Active positions</p>
          <p className="text-base font-bold" style={{ color: C.gold }}>{activeHistory.length}</p>
        </div>
      </div>

      {/* Holdings list */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.muted }}>
          Their moves · tap to shadow a specific stock
        </p>
        <div className="space-y-1.5">
          {/* Mirror whole portfolio option */}
          <button
            onClick={() => setShadowTarget('portfolio')}
            className="w-full text-left rounded-xl px-3 py-2.5"
            style={{
              background: shadowTarget === 'portfolio' ? '#2a2000' : C.surface2,
              border: `1px solid ${shadowTarget === 'portfolio' ? C.gold : C.border}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: C.gold }}>🔗 Mirror entire portfolio</p>
                <p className="text-[10px]" style={{ color: C.muted }}>Automatically tracks all of @{friend.friendName}'s moves</p>
              </div>
              {shadowTarget === 'portfolio' && <span style={{ color: C.gold }}>✓</span>}
            </div>
          </button>

          {/* Individual entries */}
          {activeHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setShadowTarget(entry.id)}
              className="w-full text-left rounded-xl px-3 py-2.5"
              style={{
                background: shadowTarget === entry.id ? '#2a2000' : C.surface2,
                border: `1px solid ${shadowTarget === entry.id ? C.gold : C.border}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{entry.optionName}</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>{entry.date} · ${entry.amount.toFixed(0)} invested</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <RiskBadge level={entry.riskLevel} />
                  {shadowTarget === entry.id && <span style={{ color: C.gold }}>✓</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Shadow amount + frequency + confirm */}
      <div className="rounded-xl px-3 py-3 space-y-3"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <p className="text-xs font-semibold" style={{ color: C.muted }}>
          {shadowTarget === 'portfolio'
            ? `🔗 Mirror @${friend.friendName}'s full portfolio`
            : `📌 Shadow "${activeHistory.find(e => e.id === shadowTarget)?.optionName || '…'}"`}
        </p>

        {/* Amount */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
          <input
            type="number" min="1" step="1"
            placeholder="Amount"
            value={shadowAmount}
            onChange={e => setShadowAmount(e.target.value)}
            className="w-full rounded-xl pl-7 pr-3 py-2 text-sm outline-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
          />
        </div>

        {/* Frequency buttons */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Frequency</p>
          <div className="grid grid-cols-5 gap-1">
            {SHADOW_FREQS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setShadowFreq(f.id)}
                className="text-[10px] py-1.5 rounded-lg font-semibold text-center"
                style={shadowFreq === f.id
                  ? { background: C.gold, color: '#0d1a0d' }
                  : { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Portfolio picker */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>Add to portfolio</p>
          <select
            value={shadowPortfolio}
            onChange={e => setShadowPortfolio(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}
          >
            <option value="">Original Portfolio</option>
            {(portfolios || []).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Confirm button */}
        <button
          onClick={doShadow}
          disabled={submitting || !shadowAmount}
          className="w-full py-2 rounded-xl text-sm font-bold"
          style={{
            background: submitting || !shadowAmount ? C.surface2 : C.goldBtn,
            color:      submitting || !shadowAmount ? C.muted    : '#0d1a0d',
          }}
        >
          {submitting ? '…' : shadowTarget === 'portfolio' ? 'Mirror all' : 'Shadow it'}
        </button>

        <p className="text-[10px]" style={{ color: C.muted }}>
          Your money mirrors this investment going forward.
        </p>
      </div>
    </div>
  );
}

// ── Shadow investments tab ────────────────────────────────────────────────────
function ShadowTab() {
  const [shadows, setShadows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ err: '', ok: '' });

  const flash = (err, ok) => {
    setFeedback({ err: err || '', ok: ok || '' });
    setTimeout(() => setFeedback({ err: '', ok: '' }), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getShadowInvestments();
      setShadows(res.data.shadows || []);
    } catch {
      setShadows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    if (!window.confirm('Remove this shadow investment?')) return;
    try {
      await api.deleteShadowInvestment(id);
      flash('', 'Shadow investment removed.');
      load();
    } catch (err) {
      flash(err.response?.data?.error || 'Error.', '');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <ErrorMsg msg={feedback.err} />
      <SuccessMsg msg={feedback.ok} />

      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        🔗 Your shadow investments ({shadows.length})
      </p>

      {shadows.length === 0 ? (
        <div className="card text-center py-10 space-y-2">
          <p className="text-4xl">🪞</p>
          <p className="font-semibold" style={{ color: C.text }}>No shadow investments yet</p>
          <p className="text-sm" style={{ color: C.muted }}>
            Go to the Friends tab, view a friend's portfolio, and copy their moves.
          </p>
        </div>
      ) : (
        shadows.map((s) => {
          const isPortfolio = s.targetType === 'portfolio';
          return (
            <div
              key={s.id}
              className="card"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isPortfolio ? '🔗' : '📌'}</span>
                    <p className="text-sm font-bold" style={{ color: C.text }}>
                      {isPortfolio ? `Mirror: ${s.friendName}'s portfolio` : `Copy move from ${s.friendName}`}
                    </p>
                  </div>
                  {!isPortfolio && (
                    <p className="text-xs pl-6" style={{ color: C.muted }}>
                      Entry ID: {s.targetId.slice(0, 8)}…
                    </p>
                  )}
                  <p className="text-xs pl-6" style={{ color: C.muted }}>
                    ${s.amount}/week · started {s.createdAt.split('T')[0]}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: isPortfolio ? 'rgba(240,180,41,0.15)' : 'rgba(74,222,128,0.12)',
                      color:      isPortfolio ? C.gold                   : C.green,
                    }}
                  >
                    {isPortfolio ? 'Full mirror' : 'Single move'}
                  </span>
                  <button
                    onClick={() => remove(s.id)}
                    className="text-xs"
                    style={{ color: C.muted }}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Simulated performance */}
              <div
                className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: C.surface2 }}
              >
                <span className="text-xs" style={{ color: C.muted }}>Simulated return</span>
                <span className="text-sm font-bold" style={{ color: C.green }}>
                  +4.5% · ${(s.amount * 1.045).toFixed(2)} est.
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Trophies tab ──────────────────────────────────────────────────────────────
function TrophiesTab() {
  const [friends, setFriends]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // { friendId, friendName } | 'self'
  const [myAwards, setMyAwards]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFriends();
      setFriends(res.data.friends || []);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
        🏆 View trophy cabinets
      </p>

      {/* Picker row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSelected('self'); setMyAwards(true); }}
          className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
          style={
            selected === 'self'
              ? { background: '#2a2000', color: C.gold, border: `1px solid ${C.gold}55` }
              : { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }
          }
        >
          🪙 Mine
        </button>
        {(friends || []).map((f) => (
          <button
            key={f.friendId}
            onClick={() => { setSelected(f.friendId); setMyAwards(false); }}
            className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
            style={
              selected === f.friendId
                ? { background: '#2a2000', color: C.gold, border: `1px solid ${C.gold}55` }
                : { background: C.surface2, color: C.muted, border: `1px solid ${C.border}` }
            }
          >
            👤 {f.friendName}
          </button>
        ))}
      </div>

      {friends.length === 0 && (
        <p className="text-sm" style={{ color: C.muted }}>Add friends to compare trophy cabinets.</p>
      )}

      {/* Awards panel */}
      {selected === 'self' && (
        <AwardsPage compact />
      )}
      {selected && selected !== 'self' && (
        <AwardsPage compact userId={selected} />
      )}
      {!selected && (
        <div
          className="rounded-xl text-center py-10"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}
        >
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-sm" style={{ color: C.muted }}>Select a person above to see their trophies.</p>
        </div>
      )}
    </div>
  );
}
