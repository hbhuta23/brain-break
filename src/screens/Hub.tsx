import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { EscapeRoomThumb, FruitSliceThumb, LaneRunnerThumb } from '../components/Thumbs';
import { formatDay, isoToDay, relativeDay } from '../engine/clock';
import { queueSummary } from '../engine/scheduler';
import { activeDays, scheduleContext, todayPlan, useDeckIndex, useMastery } from '../lib/hooks';
import { useApp } from '../store/useApp';
import './hub.css';

const FIRST_WEEK = 7;

/**
 * Today's break. For the first week the order is fixed: warm up on reviews
 * (Lane Runner), then new material (Escape Room), then mixed practice
 * (Fruit Slice). That's Rosenshine's review → new material → practice,
 * squeezed into 15 minutes. After a week, learners choose their own order.
 */
export function Hub() {
  const navigate = useNavigate();
  const index = useDeckIndex();
  const events = useApp((s) => s.events);
  const deckId = useApp((s) => s.deckId);
  const today = useApp((s) => s.today());
  const examDate = useApp((s) => s.examDate);
  const startDay = useApp((s) => s.startDay) ?? today;
  const freePlayUnlocked = useApp((s) => s.freePlayUnlocked);
  const pretestDone = useApp((s) => !!s.deckProgress().pretest);
  const mastery = useMastery(index);

  const plan = todayPlan(events, deckId, today);
  // Recompute the queue whenever the log or the day changes.
  const queue = useMemo(() => (index ? queueSummary(scheduleContext(index)) : null), [index, events, today]);

  if (!index || !queue) return null;

  const dayOfWeek = today - startDay + 1;
  const freePlay = freePlayUnlocked || dayOfWeek > FIRST_WEEK;
  const examDay = examDate ? isoToDay(examDate) : null;
  const counts = { new: 0, practicing: 0, mastered: 0 };
  mastery.forEach((m) => counts[m.state]++);
  const total = index.deck.concepts.length;
  const days = activeDays(events, deckId);

  const steps = [
    {
      key: 'lane-runner',
      n: 1,
      title: 'Warm-up',
      game: 'Lane Runner',
      art: <LaneRunnerThumb />,
      meta: `${queue.dueRunner} due · ${queue.newRunner} new`,
      done: plan.runnerDone,
      next: plan.next === 'lane-runner',
      locked: false,
    },
    { key: 'escape-room', n: 2, title: 'New room', game: 'Escape Room', art: <EscapeRoomThumb />, meta: 'Opens soon', done: false, next: false, locked: true },
    {
      key: 'fruit-slice',
      n: 3,
      title: 'Mix it up',
      game: 'Fruit Slice',
      art: <FruitSliceThumb />,
      meta: `${queue.dueSlice} due · ${queue.newSlice} new`,
      done: plan.sliceDone,
      next: plan.next === 'fruit-slice',
      locked: false,
    },
  ];

  return (
    <div className="hub page">
      <section className="hub-hero">
        <div className="hub-title">
          <h1 className="display">Today's Break</h1>
          <div className="row">
            <span className="chip">{formatDay(today)}</span>
            {dayOfWeek <= FIRST_WEEK && <span className="chip">Day {dayOfWeek} of your first week</span>}
            {examDay != null ? (
              <span className={`chip ${examDay - today <= 2 ? 'red' : 'blue'}`}>
                Quiz {examDay < today ? 'was' : ''} {relativeDay(examDay, today)}
              </span>
            ) : (
              <Link to="/settings" className="chip">
                + Add quiz date
              </Link>
            )}
            <span className="chip">
              Played on {days} day{days === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {!pretestDone && (
          <div className="panel hub-pretest pop-in">
            <div>
              <strong>Take the 10-question pretest first.</strong>
              <p className="muted">It tells Brain Break what you already know so your first session starts on the gaps.</p>
            </div>
            <button className="btn" onClick={() => navigate('/pretest')}>
              Start pretest
            </button>
          </div>
        )}

        <div className="panel path">
          <ol className="path-steps">
            {steps.map((s) => (
              <li key={s.key} className={`step ${s.done ? 'done' : ''} ${s.next ? 'next' : ''} ${s.locked ? 'locked' : ''}`}>
                <div className="step-art">
                  {s.art}
                  {s.done && <span className="step-check" aria-label="Done">✓</span>}
                  {s.locked && <span className="sticker step-soon">Coming soon</span>}
                </div>
                <div className="step-text">
                  <span className="step-n display">{s.n}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <span className="muted">
                      {s.game} · {s.meta}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="path-cta">
            {plan.next ? (
              <>
                <button className="btn green big" onClick={() => navigate(`/play/${plan.next}?mode=session`)}>
                  {plan.next === 'lane-runner' ? 'Start warm-up' : 'Continue: Fruit Slice'}
                </button>
                <span className="muted">About 10–15 minutes</span>
              </>
            ) : (
              <div className="path-done">
                <strong className="display">Break complete!</strong>
                <span className="muted">
                  Come back tomorrow: spacing it out is the whole point. Your misses are already scheduled.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="hub-grid">
        <Link to="/mastery" className="panel hub-mastery">
          <div className="row">
            <h2 className="display">Mastery</h2>
            <span className="spacer" />
            <span className="muted">Open map →</span>
          </div>
          <div className="mbar" aria-label={`${counts.mastered} mastered, ${counts.practicing} practicing, ${counts.new} new`}>
            <span className="m-mastered" style={{ flex: counts.mastered }} />
            <span className="m-practicing" style={{ flex: counts.practicing }} />
            <span className="m-new" style={{ flex: counts.new }} />
          </div>
          <div className="mcounts">
            <span>
              <b className="s-mastered">{counts.mastered}</b> mastered
            </span>
            <span>
              <b className="s-practicing">{counts.practicing}</b> practicing
            </span>
            <span>
              <b className="s-new">{counts.new}</b> new
            </span>
            <span className="muted">of {total} concepts</span>
          </div>
        </Link>

        <div className="panel hub-queue">
          <h2 className="display">Queued up</h2>
          <ul>
            <li>
              <b>{queue.dueRunner + queue.dueSlice}</b> reviews due today
            </li>
            <li>
              <b>{queue.crossGame}</b> cards from concepts you missed, queued to come back in a different game
            </li>
            <li>
              <b>{queue.newRunner + queue.newSlice}</b> cards you haven't seen yet
            </li>
          </ul>
        </div>
      </section>

      <section className="arcade">
        <div className="row">
          <h2 className="display arcade-h">Arcade</h2>
          <span className="muted">Free play: any game, any time.</span>
        </div>
        {!freePlay && (
          <p className="arcade-lock">
            🔒 Free play opens after your first week ({Math.max(0, FIRST_WEEK - dayOfWeek + 1)} days to go). Until then Brain Break picks the
            order so your practice gets spaced out instead of crammed.
          </p>
        )}
        <div className={`carts ${freePlay ? '' : 'carts-locked'}`}>
          <Cart title="Lane Runner" blurb="Quick recall at speed" art={<LaneRunnerThumb />} to="/play/lane-runner?mode=free" enabled={freePlay} />
          <Cart title="Fruit Slice" blurb="Tell look-alike ideas apart" art={<FruitSliceThumb />} to="/play/fruit-slice?mode=free" enabled={freePlay} />
          <Cart title="Escape Room" blurb="Apply ideas to escape" art={<EscapeRoomThumb />} enabled={false} soon />
        </div>
      </section>
    </div>
  );
}

function Cart({ title, blurb, art, to, enabled, soon }: { title: string; blurb: string; art: React.ReactNode; to?: string; enabled: boolean; soon?: boolean }) {
  const body = (
    <>
      <div className="cart-art">
        {art}
        {soon && <span className="sticker cart-soon">Coming soon</span>}
      </div>
      <div className="cart-label">
        <strong className="display">{title}</strong>
        <span className="muted">{blurb}</span>
      </div>
    </>
  );
  return enabled && to ? (
    <Link to={to} className="cart">
      {body}
    </Link>
  ) : (
    <div className="cart disabled" aria-disabled="true">
      {body}
    </div>
  );
}
