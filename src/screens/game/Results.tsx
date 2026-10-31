import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { DeckIndex } from '../../content/deckIndex';
import { relativeDay } from '../../engine/clock';
import { masteryByConcept, type ConceptMastery, type MasteryState } from '../../engine/mastery';
import { answersFor } from '../../lib/hooks';
import { useApp } from '../../store/useApp';

export interface RunResult {
  cardId: string;
  concept: string;
  conceptName: string;
  prompt: string;
  correct: boolean;
  chosen: string;
  answer: string;
  explanation: string;
}

const STATE_LABEL: Record<MasteryState, string> = { new: 'New', practicing: 'Practicing', mastered: 'Mastered' };

/**
 * End-of-run summary. It leads with accuracy and what comes back when, not
 * speed: fast games shouldn't teach that "fast = smart".
 */
export function Results({
  game,
  mode,
  results,
  index,
  masteryBefore,
}: {
  game: 'lane-runner' | 'fruit-slice';
  mode: 'session' | 'free' | 'practice';
  results: RunResult[];
  index: DeckIndex;
  masteryBefore: Map<string, ConceptMastery>;
}) {
  const navigate = useNavigate();
  const events = useApp((s) => s.events);
  const deckId = useApp((s) => s.deckId);
  const cards = useApp((s) => s.deckProgress().cards);
  const today = useApp((s) => s.today());

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const correct = results.filter((r) => r.correct).length;
  const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
  const misses = results.filter((r) => !r.correct);
  const hits = results.filter((r) => r.correct);

  const masteryAfter = useMemo(() => masteryByConcept(index.deck.concepts.map((c) => c.id), answersFor(events, deckId)), [index, events, deckId]);
  const touched = [...new Set(results.map((r) => r.concept))];

  const headline = pct >= 80 ? 'Clean run!' : pct >= 50 ? 'Solid run' : 'Tough one';
  const sub =
    pct >= 80
      ? "You're right around the sweet spot. Expect these to get harder as they space out."
      : pct >= 50
        ? 'The misses below are the most useful part of this run. They come back soon.'
        : "Struggling now is the kind of difficulty that makes memories stick. Every miss below is scheduled to come back.";

  const due = (cardId: string) => {
    const c = cards[cardId];
    if (!c) return '';
    return c.due <= today ? 'next session' : relativeDay(c.due, today);
  };

  return (
    <div className="results page">
      <div className="results-head pop-in">
        <span className="sticker">{game === 'lane-runner' ? 'Lane Runner' : 'Fruit Slice'}</span>
        <h1 className="display results-title">{headline}</h1>
        <p className="muted">{sub}</p>
      </div>

      <div className="results-tiles">
        <div className="panel tile">
          <span className="tile-k">Accuracy</span>
          <span className="tile-v display">{pct}%</span>
          <span className="muted">
            {correct} of {results.length} right
          </span>
        </div>
        <div className="panel tile">
          <span className="tile-k">Coming back</span>
          <span className="tile-v display">{misses.length}</span>
          <span className="muted">missed, rescheduled</span>
        </div>
        <div className="panel tile">
          <span className="tile-k">Concepts</span>
          <span className="tile-v display">{touched.length}</span>
          <span className="muted">practiced this run</span>
        </div>
      </div>

      {misses.length > 0 && (
        <section className="stack">
          <h2 className="display results-h">Coming back soon</h2>
          <p className="muted results-note">These return in a later session, often in a different game, so you practice the idea and not just the question.</p>
          {misses.map((m, i) => (
            <article key={m.cardId + i} className="panel miss">
              <div className="row">
                <span className="chip">{m.conceptName}</span>
                <span className="spacer" />
                <span className="chip yellow">back {due(m.cardId)}</span>
              </div>
              <p className="miss-prompt">{m.prompt}</p>
              <p className="miss-line">
                <span className="miss-k">You</span> <span className="miss-you">{m.chosen}</span>
              </p>
              <p className="miss-line">
                <span className="miss-k">Answer</span> <span className="miss-right">{m.answer}</span>
              </p>
              <p className="muted">{m.explanation}</p>
            </article>
          ))}
        </section>
      )}

      <section className="stack">
        <h2 className="display results-h">Mastery</h2>
        <div className="mastery-moves">
          {touched.map((c) => {
            const before = masteryBefore.get(c);
            const after = masteryAfter.get(c);
            if (!after) return null;
            const moved = before?.state !== after.state;
            return (
              <div key={c} className={`move panel ${moved ? 'moved' : ''}`}>
                <span className="move-name">{index.concept.get(c)?.short ?? c}</span>
                <span className={`state s-${after.state}`}>
                  {moved && before ? `${STATE_LABEL[before.state]} → ` : ''}
                  {STATE_LABEL[after.state]}
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(after.progress * 100)}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {hits.length > 0 && (
        <details className="panel hits">
          <summary>
            <strong>Got right ({hits.length})</strong> <span className="muted">and when you'll see them next</span>
          </summary>
          <ul>
            {hits.map((h, i) => (
              <li key={h.cardId + i}>
                <span>{h.prompt}</span>
                <span className="muted">next {due(h.cardId)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="row results-actions">
        {mode === 'session' && game === 'lane-runner' && (
          <>
            <button className="btn green big" onClick={() => navigate('/play/fruit-slice?mode=session')}>
              Next: Fruit Slice →
            </button>
            <span className="muted small-note">The Escape Room slots in between these two when it opens.</span>
          </>
        )}
        {mode === 'session' && game === 'fruit-slice' && (
          <button className="btn green big" onClick={() => navigate('/')}>
            Finish today's break
          </button>
        )}
        {mode === 'free' && (
          <>
            <button className="btn big" onClick={() => navigate(`/play/${game}?mode=free&r=${Date.now()}`, { replace: true })}>
              Play again
            </button>
            <button className="btn ghost" onClick={() => navigate('/')}>
              Back to today
            </button>
          </>
        )}
      </div>
    </div>
  );
}
