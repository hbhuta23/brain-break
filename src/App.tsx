import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { DeckErrors } from './components/DeckErrors';
import { decks, getDeck } from './content/decks';
import { setSoundEnabled } from './games/shared/sfx';
import { Hub } from './screens/Hub';
import { MasteryMap } from './screens/MasteryMap';
import { Onboarding } from './screens/Onboarding';
import { Pretest } from './screens/Pretest';
import { Settings } from './screens/Settings';
import { useApp } from './store/useApp';

// Phaser is big; only load it when a game starts.
const GameScreen = lazy(() => import('./screens/GameScreen').then((m) => ({ default: m.GameScreen })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RequireOnboarded() {
  const onboarded = useApp((s) => s.onboarded);
  return onboarded ? <Outlet /> : <Navigate to="/welcome" replace />;
}

/** Remount the game on every navigation so "Play again" starts a fresh run. */
function KeyedGame() {
  const { key } = useLocation();
  return (
    <Suspense fallback={<div className="game-root" />}>
      <GameScreen key={key} />
    </Suspense>
  );
}

function ApplySettings() {
  const { textScale, reducedMotion, sound } = useApp((s) => s.settings);
  const deckId = useApp((s) => s.deckId);
  const onboarded = useApp((s) => s.onboarded);
  const setDeck = useApp((s) => s.setDeck);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
    document.body.classList.toggle('reduce-motion', reducedMotion);
    setSoundEnabled(sound);
  }, [textScale, reducedMotion, sound]);

  // If a deck was removed or renamed, fall back to the first one available.
  useEffect(() => {
    if (onboarded && !getDeck(deckId) && decks[0]) setDeck(decks[0].id);
  }, [onboarded, deckId, setDeck]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <ApplySettings />
      <ScrollToTop />
      <DeckErrors />
      <Routes>
        <Route path="/welcome" element={<Onboarding />} />
        <Route path="/play/:game" element={<KeyedGame />} />
        <Route element={<RequireOnboarded />}>
          <Route element={<Layout />}>
            <Route index element={<Hub />} />
            <Route path="/mastery" element={<MasteryMap />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/pretest" element={<Pretest />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
