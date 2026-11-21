import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthContext';

export default function NavBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto px-4 flex items-center justify-between" style={{ height: '3.5rem', minHeight: '3.5rem' }}>
        {/* Logo */}
        <Link
          to={token ? '/start' : '/login'}
          className="no-underline shrink-0 flex items-center gap-1.5"
          style={{ whiteSpace: 'nowrap' }}
        >
          <img src="/logo.png" alt="Liquid Gold" style={{ width: '1.6rem', height: '1.6rem', flexShrink: 0 }} />
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--gold)', lineHeight: 1 }}>
            Liquid Gold
          </span>
        </Link>

        {/* Nav links */}
        {token ? (
          <nav className="flex items-center gap-0.5 text-xs font-medium overflow-hidden" style={{ flexShrink: 1 }}>
            <NavLink to="/start"     active={pathname === '/start'}     data-tutorial="Invest">Invest</NavLink>
            <NavLink to="/browse"    active={pathname === '/browse'}     data-tutorial="Browse">Browse</NavLink>
            <NavLink to="/dashboard" active={pathname === '/dashboard'}  data-tutorial="Dashboard">Dashboard</NavLink>
            <NavLink to="/friends"   active={pathname === '/friends'}    data-tutorial="Friends">Friends</NavLink>
            <NavLink to="/awards"    active={pathname === '/awards'}     data-tutorial="Trophies">Trophies</NavLink>
            <NavLink to="/settings"  active={pathname === '/settings'}   data-tutorial="Settings">Settings</NavLink>

            <div className="flex items-center gap-1.5 ml-1.5 pl-1.5 shrink-0" style={{ borderLeft: '1px solid var(--border)' }}>
              {user?.name && (
                <span className="text-xs hidden md:block" style={{ color: 'var(--muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-xs px-2 py-1 rounded-lg transition-colors shrink-0"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)', background: 'transparent', whiteSpace: 'nowrap' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                Log out
              </button>
            </div>
          </nav>
        ) : (
          <nav className="flex items-center gap-1 text-sm font-medium shrink-0">
            <NavLink to="/login" active={pathname === '/login'}>Log in</NavLink>
            <Link
              to="/register"
              className="ml-1 px-3 py-1.5 rounded-lg font-bold text-xs shrink-0"
              style={{ background: 'linear-gradient(135deg,#c98a00,#f0b429)', color: '#0d1a0d', whiteSpace: 'nowrap' }}
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function NavLink({ to, active, children, 'data-tutorial': dataTutorial }) {
  return (
    <Link
      to={to}
      data-tutorial={dataTutorial}
      className="px-2 py-1.5 rounded-lg transition-colors text-xs font-medium"
      style={
        active
          ? { background: 'var(--gold-pale)', color: 'var(--gold)', fontWeight: 600, whiteSpace: 'nowrap' }
          : { color: 'var(--muted)', whiteSpace: 'nowrap' }
      }
    >
      {children}
    </Link>
  );
}
