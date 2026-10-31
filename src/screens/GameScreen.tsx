import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PhaserGame } from '../games/shared/PhaserGame';
import { Bridge, type Feedback } from '../games/shared/bridge';
import { LaneRunnerScene } from '../games/laneRunner/LaneRunnerScene';
import { FruitSliceScene } from '../games/fruitSlice/FruitSliceScene';
import { setSoundEnabled } from '../games/shared/sfx';
import { FeedbackCard } from '../components/FeedbackCard';
import { useApp } from '../store/useApp';
import { answersFor, scheduleContext, useDeckIndex } from '../lib/hooks';
import { PRACTICE_ITEMS } from '../lib/practice';
import { pickRunnerItems, pickSlicePlan, type RunnerItem, type SlicePlan } from '../engine/scheduler';
import { newSessionId } from '../engine/events';
import { masteryByConcept, type ConceptMastery } from '../engine/mastery';
import { RunnerHud } from './game/RunnerHud';
import { SliceHud } from './game/SliceHud';
import { HowToPlay } from './game/HowToPlay';
import { Results, type RunResult } from './game/Results';
import './game/game.css';

type GameKey = 'lane-runner' | 'fruit-slice';
type Mode = 'session' | 'free' | 'practice';

const RUNNER_LENGTH = 8;

interface Setup {
  bridge: Bridge;
  sessionId: string;
  runnerItems: RunnerItem[];
  slicePlan: SlicePlan | null;
  masteryBefore: Map<string, ConceptMastery>;
  startedAt: number;
}

export function GameScreen() {
  const { game: gameParam } = useParams();
  const game: GameKey = gameParam === 'fruit-slice' ? 'fruit-slice' : 'lane-runner';
  const [params] = useSearchParams();
  const mode = (params.get('mode') ?? 'free') as Mode;
  const navigate = useNavigate();
  const index = useDeckIndex();
  const settings = useApp((s) => s.settings);
  const recordAnswer = useApp((s) => s.recordAnswer);
  const logSession = useApp((s) => s.logSession);
  const logApp = useApp((s) => s.logApp);
  const markTutorial = useApp((s) => s.markTutorial);
  const tutorialSeen = useApp((s) => s.seenTutorials.includes(game));

  const setup = useMemo<Setup | null>(() => {
    if (!index && mode !== 'practice') return null;
    setSoundEnabled(settings.sound);
    const s = useApp.getState();
    return {
      bridge: new Bridge({ ...settings }),
      sessionId: newSessionId(),
      runnerItems: mode === 'practice' ? PRACTICE_ITEMS : game === 'lane-runner' && index ? pickRunnerItems(scheduleContext(index), RUNNER_LENGTH) : [],
      slicePlan: game === 'fruit-slice' && index ? pickSlicePlan(scheduleContext(index)) : null,
      masteryBefore: index ? masteryByConcept(index.deck.concepts.map((c) => c.id), answersFor(s.events, s.deckId)) : new Map(),
      startedAt: Date.now(),
    };
    // A run is fixed once it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [started, setStarted] = useState(mode === 'practice' || tutorialSeen);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [results, setResults] = useState<RunResult[]>([]);
  const [ended, setEnded] = useState(false);
  const loggedStart = useRef(false);
  const endedRef = useRef(false);
  const resultsRef = useRef<RunResult[]>([]);
  resultsRef.current = results;

  const gameId = mode === 'practice' ? 'practice' : game;

  // Bridge events -> store + UI
  useEffect(() => {
    if (!setup || !started) return;
    const { bridge, sessionId } = setup;

    if (!loggedStart.current) {
      loggedStart.current = true;
      logSession({ type: 'session-start', game: gameId, mode, sessionId });
    }

    const offs = [
      bridge.on('runner:answer', ({ item, option, rtMs, speed }) => {
        const correctOpt = item.options.find((o) => o.correct)!;
        if (mode !== 'practice') {
          const q = index?.question.get(item.cardId);
          if (q) recordAnswer({ q, game: 'lane-runner', sessionId, correct: option.correct, response: option.text, rtMs, speed, misconception: option.label });
        }
        setResults((r) => [
          ...r,
          { cardId: item.cardId, concept: item.concept, conceptName: item.conceptName, prompt: item.stem, correct: option.correct, chosen: option.text, answer: correctOpt.text, explanation: item.explanation },
        ]);
      }),
      bridge.on('slice:result', ({ item, setId, sliced, correct, rtMs }) => {
        const q = index?.question.get(item.cardId);
        const prompt = index?.sortSet.get(setId)?.prompt ?? setId;
        const misconception = correct ? undefined : sliced ? 'sliced a non-example' : 'missed an example';
        if (q) recordAnswer({ q, game: 'fruit-slice', sessionId, correct, response: sliced ? 'sliced' : 'let-fall', rtMs, misconception });
        setResults((r) => [
          ...r,
          {
            cardId: item.cardId,
            concept: item.concept,
            conceptName: item.conceptName,
            prompt: `${prompt}: "${item.text}"`,
            correct,
            chosen: sliced ? 'Sliced it' : 'Let it fall',
            answer: item.match ? 'Slice it' : 'Let it fall',
            explanation: item.why,
          },
        ]);
      }),
      bridge.on('feedback', (fb) => {
        setFeedback(fb);
        logApp('feedback-viewed', { game: gameId, tone: fb.tone });
      }),
      bridge.on('end', ({ reason }) => {
        if (endedRef.current) return;
        endedRef.current = true;
        const rs = resultsRef.current;
        logSession({
          type: 'session-end',
          game: gameId,
          mode,
          sessionId,
          reason,
          attempted: rs.length,
          correct: rs.filter((r) => r.correct).length,
          durationMs: Date.now() - setup.startedAt,
        });
        setEnded(true);
      }),
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, started]);

  // Leaving mid-run (back button, quit) still closes the session in the log.
  // Deferred a tick so React's dev-mode remount doesn't count as quitting.
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      setTimeout(() => {
        if (alive.current || !setup) return;
        setup.bridge.clear();
        if (!loggedStart.current || endedRef.current) return;
        endedRef.current = true;
        const rs = resultsRef.current;
        useApp.getState().logSession({
          type: 'session-end',
          game: gameId,
          mode,
          sessionId: setup.sessionId,
          reason: 'quit',
          attempted: rs.length,
          correct: rs.filter((r) => r.correct).length,
          durationMs: Date.now() - setup.startedAt,
        });
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quit = () => navigate(mode === 'practice' ? '/welcome?step=setup' : '/');

  if (!setup) {
    return (
      <div className="game-empty page">
        <p>No deck selected yet.</p>
        <button className="btn" onClick={() => navigate('/welcome')}>
          Set up Brain Break
        </button>
      </div>
    );
  }

  const nothing = game === 'lane-runner' ? setup.runnerItems.length === 0 : !setup.slicePlan;
  if (nothing) {
    return (
      <div className="game-empty page stack">
        <h1 className="display">Nothing to play here yet</h1>
        <p className="muted">This deck doesn't have questions for this game.</p>
        <button className="btn" onClick={() => navigate('/')}>
          Back
        </button>
      </div>
    );
  }

  if (ended && mode === 'practice') {
    return (
      <div className={`game-root game-${game}`}>
        <div className="practice-done pop-in panel">
          <h1 className="display">You've got it!</h1>
          <p>That's the whole idea: every move you make is an answer. Wrong gates stop and explain why.</p>
          <button className="btn green big" autoFocus onClick={() => navigate('/welcome?step=setup')}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (ended && index) {
    return <Results game={game} mode={mode} results={results} index={index} masteryBefore={setup.masteryBefore} />;
  }

  return (
    <div className={`game-root game-${game} ${settings.reducedMotion ? 'reduce-motion' : ''}`}>
      {started && (
        <PhaserGame
          scene={game === 'lane-runner' ? LaneRunnerScene : FruitSliceScene}
          data={game === 'lane-runner' ? { bridge: setup.bridge, items: setup.runnerItems, practice: mode === 'practice' } : { bridge: setup.bridge, plan: setup.slicePlan }}
          background={game === 'lane-runner' ? '#05060d' : '#3a2414'}
        />
      )}

      {started && game === 'lane-runner' && <RunnerHud bridge={setup.bridge} practice={mode === 'practice'} walk={settings.walkMode} onQuit={quit} />}
      {started && game === 'fruit-slice' && <SliceHud bridge={setup.bridge} plan={setup.slicePlan!} onQuit={quit} />}

      {!started && (
        <HowToPlay
          game={game}
          onStart={() => {
            markTutorial(game);
            setStarted(true);
          }}
          onBack={() => navigate('/')}
        />
      )}

      {feedback && (
        <FeedbackCard
          fb={feedback}
          onContinue={() => {
            setFeedback(null);
            setup.bridge.emit('resume');
          }}
        />
      )}
    </div>
  );
}
