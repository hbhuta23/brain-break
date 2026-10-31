import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { Mcq } from '../content/schema';
import { newSessionId } from '../engine/events';
import { shuffle } from '../engine/scheduler';
import { useDeckIndex } from '../lib/hooks';
import { useApp } from '../store/useApp';
import './pretest.css';

interface Choice {
  text: string;
  correct: boolean;
  label?: string;
  misconception?: string;
}

interface Answer {
  q: Mcq;
  correct: boolean;
  response: string;
  rtMs: number;
  misconception?: string;
  label?: string;
}

const UNSURE = 'Not sure yet';
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Diagnostic pretest (Ausubel: start from what the learner already knows).
 * Ten questions, plain cards, no timer and no feedback until the end. Wrong
 * answers are written from misconceptions, so a miss tells us which mistaken
 * idea the learner holds. Misses go into Leitner box 1 so they come up first.
 */
export function Pretest() {
  const navigate = useNavigate();
  const index = useDeckIndex();
  const recordPretest = useApp((s) => s.recordPretest);
  const [sessionId] = useState(newSessionId);

  const questions = useMemo(() => {
    if (!index) return [];
    const mcqs = index.deck.questions.filter((q): q is Mcq => q.type === 'mcq');
    const flagged = mcqs.filter((q) => q.pretest);
    return (flagged.length ? flagged : mcqs).slice(0, 10).map((q) => ({
      q,
      choices: shuffle<Choice>([{ text: q.answer, correct: true }, ...q.distractors.map((d) => ({ text: d.text, correct: false, label: d.label, misconception: d.misconception }))]),
    }));
  }, [index]);

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const shownAt = useRef(Date.now());
  const done = answers.length === questions.length && questions.length > 0;

  useEffect(() => {
    shownAt.current = Date.now();
  }, [i]);

  const pick = (c: Choice | null) => {
    const { q } = questions[i];
    const a: Answer = {
      q,
      correct: !!c?.correct,
      response: c?.text ?? UNSURE,
      rtMs: Date.now() - shownAt.current,
      misconception: c && !c.correct ? c.misconception : undefined,
      label: c && !c.correct ? c.label : undefined,
    };
    const next = [...answers, a];
    setAnswers(next);
    // Log the short misconception label (codable for analysis), not the full feedback text.
    if (next.length === questions.length) recordPretest(sessionId, next.map((x) => ({ ...x, misconception: x.label })));
    else setI(i + 1);
  };

  useEffect(() => {
    if (done || !questions[i]) return;
    const onKey = (e: KeyboardEvent) => {
      const k = LETTERS.indexOf(e.key.toUpperCase());
      if (k >= 0 && k < questions[i].choices.length) pick(questions[i].choices[k]);
      if (e.key === '?' || e.key === '0') pick(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!index) return <Navigate to="/welcome" replace />;

  if (done) return <PretestSummary answers={answers} conceptName={(c) => index.concept.get(c)?.name ?? c} onDone={() => navigate('/')} />;

  const cur = questions[i];
  return (
    <div className="pt page">
      <div className="pt-head">
        <span className="sticker">Pretest · not graded</span>
        <div className="pt-bar" aria-label={`Question ${i + 1} of ${questions.length}`}>
          <span style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
        <span className="pt-count display">
          {i + 1}/{questions.length}
        </span>
      </div>

      <div className="panel pt-card pop-in" key={cur.q.id}>
        <p className="pt-stem">{cur.q.stem}</p>
        <div className="pt-choices">
          {cur.choices.map((c, k) => (
            <button key={c.text} className="pt-choice" onClick={() => pick(c)}>
              <span className="pt-letter display">{LETTERS[k]}</span>
              <span>{c.text}</span>
            </button>
          ))}
        </div>
        <button className="pt-unsure linkish" onClick={() => pick(null)}>
          {UNSURE}
        </button>
      </div>
      <p className="muted pt-foot">No feedback until the end. Guessing is fine, but "Not sure yet" is more useful than a wild guess.</p>
    </div>
  );
}

function PretestSummary({ answers, conceptName, onDone }: { answers: Answer[]; conceptName: (c: string) => string; onDone: () => void }) {
  const right = answers.filter((a) => a.correct).length;
  const misconceptions = answers.filter((a) => a.misconception);
  const gaps = [...new Set(answers.filter((a) => !a.correct).map((a) => conceptName(a.q.concept)))];

  return (
    <div className="pt page">
      <div className="pt-sum-head pop-in">
        <span className="sticker">Pretest done</span>
        <h1 className="display pt-score">
          {right}
          <small>/{answers.length}</small>
        </h1>
        <p className="muted">This isn't a grade. It's your starting line.</p>
      </div>

      {gaps.length > 0 && (
        <section className="panel stack">
          <h2 className="display pt-h">Your first sessions start here</h2>
          <div className="row">
            {gaps.map((g) => (
              <span key={g} className="chip yellow">
                {g}
              </span>
            ))}
          </div>
          <p className="muted">These come up first in today's warm-up. The ones you got right come back tomorrow to check they stuck.</p>
        </section>
      )}

      {misconceptions.length > 0 && (
        <section className="stack">
          <h2 className="display pt-h">Mix-ups we spotted</h2>
          {misconceptions.map((a) => (
            <article key={a.q.id} className="panel pt-mis">
              {a.label && <span className="chip yellow pt-mixup">Mix-up: {a.label}</span>}
              <p className="pt-mis-q">{a.q.stem}</p>
              <p>
                <span className="pt-k">You said</span> <span className="pt-you">{a.response}</span>
              </p>
              <p>
                <span className="pt-k">Why not</span> {a.misconception}
              </p>
              <p>
                <span className="pt-k">Answer</span> <span className="pt-right">{a.q.answer}</span>
              </p>
            </article>
          ))}
        </section>
      )}

      <button className="btn green big" autoFocus onClick={onDone}>
        Go to today's break
      </button>
    </div>
  );
}
