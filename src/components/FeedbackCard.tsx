import { useEffect, useRef, useState } from 'react';
import type { Feedback } from '../games/shared/bridge';
import './feedback.css';

/**
 * Shown when a learner picks a wrong answer. It explains *why* that answer
 * is wrong (written from the misconception), then gives the right idea and
 * where it comes from in the notes.
 */
export function FeedbackCard({ fb, onContinue }: { fb: Feedback; onContinue: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    // Small delay so a key held from gameplay doesn't instantly dismiss the card.
    const t = setTimeout(() => btn.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fb-backdrop" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <div className={`fb-card panel pop-in tone-${fb.tone}`}>
        <div className="fb-strip" />
        <h2 id="fb-title" className="display fb-title">
          {fb.title}
        </h2>

        {fb.chosen && (
          <div className="fb-row">
            <span className="fb-label">You picked</span>
            <p className="fb-chosen">{fb.chosen}</p>
          </div>
        )}
        {fb.misconception && (
          <div className="fb-row">
            <span className="fb-label">Why not</span>
            <p>
              {fb.label && <span className="fb-mixup">Mix-up: {fb.label}</span>}
              {fb.misconception}
            </p>
          </div>
        )}
        {fb.correct && (
          <div className="fb-row">
            <span className="fb-label">Answer</span>
            <p className="fb-correct">{fb.correct}</p>
          </div>
        )}
        {fb.items && (
          <ul className="fb-items">
            {fb.items.map((it) => (
              <li key={it.text}>
                <p className="fb-chosen">{it.text}</p>
                <p className="muted">{it.note}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="fb-row">
          <span className="fb-label">Remember</span>
          <p>{fb.explanation}</p>
        </div>

        {fb.source && (
          <div className="fb-source">
            <button className="linkish" onClick={() => setShowSource((v) => !v)} aria-expanded={showSource}>
              {showSource ? 'Hide' : 'Show'} where this is in your notes
            </button>
            {showSource && (
              <blockquote>
                {fb.source.passage}
                <cite>{fb.source.ref}</cite>
              </blockquote>
            )}
          </div>
        )}

        <button ref={btn} className="btn green big fb-go" onClick={onContinue}>
          Got it, keep going
        </button>
      </div>
    </div>
  );
}
