import { NavLink, Outlet, Link } from 'react-router';
import { Logo } from './Logo';
import { useApp } from '../store/useApp';
import { formatDay } from '../engine/clock';
import { getDeck } from '../content/decks';
import './layout.css';

export function Layout() {
  const dayOffset = useApp((s) => s.dayOffset);
  const today = useApp((s) => s.today());
  const skipDay = useApp((s) => s.skipDay);
  const deck = getDeck(useApp((s) => s.deckId));

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="topbar-logo" aria-label="Brain Break home">
          <Logo />
        </Link>
        <nav className="topnav" aria-label="Main">
          <NavLink to="/" end>
            Today
          </NavLink>
          <NavLink to="/mastery">Mastery</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="spacer" />
        <div className="clock" title="The app's date. Use 'Skip a day' to see spaced reviews come back without waiting.">
          <span className={`chip ${dayOffset ? 'yellow' : ''}`}>
            {dayOffset ? `Demo +${dayOffset}d · ` : ''}
            {formatDay(today)}
          </span>
          <button className="btn small ghost" onClick={skipDay}>
            Skip a day ⏭
          </button>
        </div>
      </header>
      {deck?.placeholder && (
        <div className="placeholder-banner" role="note">
          <strong>Sample deck.</strong> These questions are placeholders while the real Module 1 deck is being written.
        </div>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
