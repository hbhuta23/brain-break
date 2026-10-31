import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { EscapeRoomThumb, FruitSliceThumb, LaneRunnerThumb } from '../components/Thumbs';
import { decks } from '../content/decks';
import { dayToIso } from '../engine/clock';
import { useApp } from '../store/useApp';
import './onboarding.css';

const STEPS = ['hello', 'predict', 'how', 'tracking', 'setup'] as const;
type Step = (typeof STEPS)[number];

/**
 * About two minutes, start to finish:
 *  1. hello      a hook
 *  2. predict    guess which study plan wins, then see the result (Roediger & Karpicke, 2006)
 *  3. how        how the games and the schedule fit together
 *  4. tracking   what gets recorded, and what the app can't know
 *  →  practice   a no-stakes Lane Runner round to learn the controls
 *  5. setup      choose a deck and quiz date, then the pretest
 */
export function Onboarding() {
  const [params, setParams] = useSearchParams();
  const step = (STEPS.includes(params.get('step') as Step) ? params.get('step') : 'hello') as Step;
  const go = (s: Step) => setParams({ step: s });
  const i = STEPS.indexOf(step);

  return (
    <div className="ob">
      <div className="ob-progress" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
        {STEPS.map((s, j) => (
          <span key={s} className={j <= i ? 'on' : ''} />
        ))}
      </div>
      <div className="ob-body" key={step}>
        {step === 'hello' && <Hello next={() => go('predict')} />}
        {step === 'predict' && <Predict next={() => go('how')} />}
        {step === 'how' && <How next={() => go('tracking')} />}
        {step === 'tracking' && <Tracking next={() => go('setup')} />}
        {step === 'setup' && <Setup />}
      </div>
    </div>
  );
}

function Hello({ next }: { next: () => void }) {
  return (
    <section className="ob-hello pop-in">
      <Logo size="xl" />
      <p className="ob-tag">
        Remember computer lab, racing through your work to get to the games?
        <br />
        <strong>Here the games are the work.</strong>
      </p>
      <button className="btn big" autoFocus onClick={next}>
        Start · about 2 min
      </button>
    </section>
  );
}

function Predict({ next }: { next: () => void }) {
  const [guess, setGuess] = useState<'reread' | 'test' | null>(null);
  const bars = [
    { label: '5 minutes later', reread: 83, test: 71 },
    { label: 'One week later', reread: 40, test: 61 },
  ];
  return (
    <section className="ob-card panel pop-in">
      <span className="sticker">Quick question</span>
      <h1 className="display ob-h">Two students, same notes, four study periods.</h1>
      <p className="ob-lead">Who remembers more a week later?</p>
      <div className="ob-choices">
        <button className={`ob-choice ${guess === 'reread' ? 'picked' : ''}`} onClick={() => setGuess('reread')} disabled={!!guess}>
          <strong>Ava</strong>
          <span>rereads the notes 4 times</span>
        </button>
        <button className={`ob-choice ${guess === 'test' ? 'picked' : ''}`} onClick={() => setGuess('test')} disabled={!!guess}>
          <strong>Ben</strong>
          <span>reads once, then quizzes himself 3 times</span>
        </button>
      </div>

      {guess && (
        <div className="ob-reveal pop-in">
          <p className="ob-verdict">
            {guess === 'test' ? 'Right: Ben wins, and by a lot.' : "Most people pick Ava. It's Ben, and by a lot."} Rereading{' '}
            <em>feels</em> better, and it even wins after 5 minutes. A week later it loses badly.
          </p>
          <div className="chart" role="img" aria-label="Recall after 5 minutes: rereading 83%, self-testing 71%. After one week: rereading 40%, self-testing 61%.">
            {bars.map((b) => (
              <div key={b.label} className="chart-group">
                <div className="chart-bars">
                  <div className="cb reread" style={{ height: `${b.reread}%` }}>
                    <span>{b.reread}%</span>
                  </div>
                  <div className="cb test" style={{ height: `${b.test}%` }}>
                    <span>{b.test}%</span>
                  </div>
                </div>
                <span className="chart-label">{b.label}</span>
              </div>
            ))}
            <div className="chart-key">
              <span>
                <i className="reread" /> Reread ×4
              </span>
              <span>
                <i className="test" /> Read once + 3 self-tests
              </span>
            </div>
          </div>
          <p className="muted ob-cite">Recall of a prose passage. Roediger &amp; Karpicke (2006), Experiment 2.</p>
          <p>
            That's why Brain Break never shows you your notes to reread. <strong>It makes you pull answers out of memory</strong>, and
            spaces it out over days.
          </p>
          <button className="btn green" autoFocus onClick={next}>
            Got it
          </button>
        </div>
      )}
    </section>
  );
}

function How({ next }: { next: () => void }) {
  return (
    <section className="ob-card panel pop-in">
      <span className="sticker">How it works</span>
      <h1 className="display ob-h">Every move is an answer.</h1>
      <div className="ob-three">
        <figure>
          <LaneRunnerThumb />
          <figcaption>
            <strong>Lane Runner.</strong> Run through the gate with the right answer. Quick recall.
          </figcaption>
        </figure>
        <figure>
          <FruitSliceThumb />
          <figcaption>
            <strong>Fruit Slice.</strong> Slice the examples of one idea and let the look-alikes fall.
          </figcaption>
        </figure>
        <figure>
          <EscapeRoomThumb />
          <figcaption>
            <strong>Escape Room.</strong> Apply ideas to open the locks, then explain one to get out. <em>Coming soon.</em>
          </figcaption>
        </figure>
      </div>
      <ul className="ob-points">
        <li>
          <b>Misses come back</b> in a later session, usually in a different game, so you learn the idea and not just the question.
        </li>
        <li>
          <b>Little and often.</b> Four 15-minute breaks across the week beat one long night before the quiz.
        </li>
        <li>
          <b>Mastery means</b> getting a concept right 3 times, on 2 different days, in 2 kinds of question. Nobody is ranked against
          anybody.
        </li>
      </ul>
      <button className="btn green" autoFocus onClick={next}>
        Next
      </button>
    </section>
  );
}

function Tracking({ next }: { next: () => void }) {
  const navigate = useNavigate();
  return (
    <section className="ob-card panel pop-in">
      <span className="sticker">Heads up</span>
      <h1 className="display ob-h">What Brain Break keeps track of</h1>
      <div className="ob-two">
        <div>
          <h3>Recorded</h3>
          <ul>
            <li>Every answer, right or wrong, and how long it took</li>
            <li>Which hints you used and how confident you said you were</li>
            <li>When you played and for how long</li>
          </ul>
          <p className="muted">
            It all stays in this browser. You can see it, export it or delete it any time from <b>Settings</b>.
          </p>
        </div>
        <div>
          <h3>What it can't know</h3>
          <p>
            Brain Break only knows what's in the deck. <b>It can't tell you what your notes left out</b>, so you still need to check
            the deck against what your class actually covers.
          </p>
        </div>
      </div>
      <div className="row">
        <button className="btn green" autoFocus onClick={() => navigate('/play/lane-runner?mode=practice')}>
          Try a practice run
        </button>
        <button className="linkish" onClick={next}>
          Skip, I've played games like this
        </button>
      </div>
    </section>
  );
}

function Setup() {
  const navigate = useNavigate();
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const today = useApp((s) => s.today());
  const [deckId, setDeckId] = useState(decks[0]?.id ?? '');
  const [noDate, setNoDate] = useState(false);
  const [date, setDate] = useState(dayToIso(today + 7));

  const ok = deckId && (noDate || date >= dayToIso(today));

  return (
    <section className="ob-card panel pop-in">
      <span className="sticker">Last step</span>
      <h1 className="display ob-h">What are you studying for?</h1>

      <fieldset className="ob-decks">
        <legend>Deck</legend>
        {decks.map((d) => (
          <label key={d.id} className={`ob-deck ${deckId === d.id ? 'on' : ''}`}>
            <input type="radio" name="deck" value={d.id} checked={deckId === d.id} onChange={() => setDeckId(d.id)} />
            <span className="ob-deck-title">
              {d.title} {d.placeholder && <span className="chip yellow">placeholder</span>}
            </span>
            <span className="muted">
              {d.description} · {d.questions.length} questions · {d.concepts.length} concepts
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="ob-date">
        <legend>Next quiz or exam</legend>
        <div className="row">
          <input
            type="date"
            value={date}
            min={dayToIso(today)}
            disabled={noDate}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Quiz date"
          />
          <label className="row ob-check">
            <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> No date yet
          </label>
        </div>
        <p className="muted">Reviews get squeezed in before this date so nothing is scheduled after your quiz.</p>
      </fieldset>

      <p>
        Next is a <b>10-question pretest</b>. It isn't graded. It shows what you already know, so your first sessions start on the
        gaps.
      </p>
      <button
        className="btn green big"
        disabled={!ok}
        onClick={() => {
          completeOnboarding(deckId, noDate ? null : date);
          navigate('/pretest');
        }}
      >
        Start the pretest
      </button>
    </section>
  );
}
