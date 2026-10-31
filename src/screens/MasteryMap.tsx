import { useState } from 'react';
import { MASTERY_RULE, type ConceptMastery } from '../engine/mastery';
import { runnerFit } from '../engine/scheduler';
import { useDeckIndex, useMastery } from '../lib/hooks';
import './mastery.css';

const ROW = 112;
const WORLD_COLORS = ['#38b6ff', '#ff8c42', '#44d07b', '#ffd23f', '#ff5964'];

/**
 * Mastery map, a level-select style world map. Each topic is a world and
 * each concept a level node. A node's ring fills as the learner meets the
 * mastery criteria (criterion-referenced, never ranked against anyone).
 */
export function MasteryMap() {
  const index = useDeckIndex();
  const mastery = useMastery(index);
  const [sel, setSel] = useState<string | null>(null);
  if (!index) return null;

  const selected = sel ? index.concept.get(sel) : null;
  const sm = sel ? mastery.get(sel) : undefined;

  return (
    <div className="mm page">
      <header className="mm-head">
        <h1 className="display">Mastery Map</h1>
        <p className="muted">
          A concept is <b className="s-mastered">mastered</b> once you get it right {MASTERY_RULE.correct} times, on {MASTERY_RULE.days} different
          days, in {MASTERY_RULE.kinds} kinds of question, including one where you apply it.
        </p>
        <div className="mm-legend">
          <span>
            <i className="lg new" /> New
          </span>
          <span>
            <i className="lg practicing" /> Practicing
          </span>
          <span>
            <i className="lg mastered" /> Mastered
          </span>
          <span>
            <i className="lg shaky">!</i> Last answer was a miss
          </span>
        </div>
      </header>

      <div className="mm-layout">
        <div className="mm-worlds">
          {index.deck.topics.map((t, ti) => {
            const concepts = index.deck.concepts.filter((c) => c.topic === t.id);
            const pts = concepts.map((_, i) => [i % 2 ? 72 : 28, i * ROW + 56] as const);
            const d = pts.map(([x, y], i) => {
              if (i === 0) return `M ${x} ${y}`;
              const [px, py] = pts[i - 1];
              return `C ${px} ${py + ROW * 0.55}, ${x} ${y - ROW * 0.55}, ${x} ${y}`;
            });
            const done = concepts.filter((c) => mastery.get(c.id)?.state === 'mastered').length;
            return (
              <section key={t.id} className="world panel" style={{ ['--world' as string]: WORLD_COLORS[ti % WORLD_COLORS.length] }}>
                <div className="world-head">
                  <span className="world-n display">W{ti + 1}</span>
                  <div>
                    <h2 className="display">{t.title}</h2>
                    <span className="muted">
                      {done}/{concepts.length} mastered
                    </span>
                  </div>
                </div>
                <div className="world-track" style={{ height: concepts.length * ROW }}>
                  <svg className="world-path" viewBox={`0 0 100 ${concepts.length * ROW}`} preserveAspectRatio="none" aria-hidden="true">
                    <path d={d.join(' ')} vectorEffect="non-scaling-stroke" />
                  </svg>
                  {concepts.map((c, i) => (
                    <Node
                      key={c.id}
                      label={c.short}
                      m={mastery.get(c.id)!}
                      x={pts[i][0]}
                      y={pts[i][1]}
                      active={sel === c.id}
                      onClick={() => setSel(sel === c.id ? null : c.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className={`mm-detail panel ${selected ? 'open' : ''}`} aria-live="polite">
          {selected && sm ? (
            <div className="stack pop-in" key={selected.id}>
              <span className={`chip ${sm.state === 'mastered' ? 'green' : sm.state === 'practicing' ? 'yellow' : ''}`}>{sm.state}</span>
              <h2 className="display">{selected.name}</h2>
              <p>{selected.definition}</p>
              <ul className="crit">
                <Crit ok={sm.correct >= MASTERY_RULE.correct} label={`Right ${MASTERY_RULE.correct} times`} have={`${Math.min(sm.correct, MASTERY_RULE.correct)}/${MASTERY_RULE.correct}`} />
                <Crit ok={sm.days >= MASTERY_RULE.days} label={`On ${MASTERY_RULE.days} different days`} have={`${Math.min(sm.days, MASTERY_RULE.days)}/${MASTERY_RULE.days}`} />
                <Crit ok={sm.kinds >= MASTERY_RULE.kinds} label={`In ${MASTERY_RULE.kinds} kinds of question`} have={`${Math.min(sm.kinds, MASTERY_RULE.kinds)}/${MASTERY_RULE.kinds}`} />
                <Crit ok={sm.hasApply} label="At least once applying it" have={sm.hasApply ? 'yes' : 'not yet'} />
              </ul>
              <p className="muted">
                {sm.attempts} attempt{sm.attempts === 1 ? '' : 's'} so far.
              </p>
              <Appears conceptId={selected.id} />
            </div>
          ) : (
            <div className="mm-empty">
              <p className="display">Pick a level</p>
              <p className="muted">Tap any concept to see what's left before it counts as mastered.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Node({ label, m, x, y, active, onClick }: { label: string; m: ConceptMastery; x: number; y: number; active: boolean; onClick: () => void }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <button
      className={`node n-${m.state} ${active ? 'active' : ''}`}
      style={{ left: `${x}%`, top: y }}
      onClick={onClick}
      aria-label={`${label}: ${m.state}`}
      aria-pressed={active}
    >
      <svg viewBox="0 0 64 64" className="node-ring" aria-hidden="true">
        <circle cx="32" cy="32" r={R} className="ring-bg" />
        {m.progress > 0 && <circle cx="32" cy="32" r={R} className="ring-fg" strokeDasharray={`${C * m.progress} ${C}`} transform="rotate(-90 32 32)" />}
        <circle cx="32" cy="32" r="18" className="node-core" />
        {m.state === 'mastered' ? (
          <path className="node-star" d="M32 20l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1L32 38.6l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z" />
        ) : (
          <text x="32" y="37" className="node-pct">
            {Math.round(m.progress * 100)}
          </text>
        )}
      </svg>
      {m.shaky && <span className="node-shaky">!</span>}
      <span className="node-label">{label}</span>
    </button>
  );
}

function Crit({ ok, label, have }: { ok: boolean; label: string; have: string }) {
  return (
    <li className={ok ? 'ok' : ''}>
      <span className="crit-box" aria-hidden="true">
        {ok ? '✓' : ''}
      </span>
      <span>{label}</span>
      <span className="muted">{have}</span>
    </li>
  );
}

function Appears({ conceptId }: { conceptId: string }) {
  const index = useDeckIndex();
  if (!index) return null;
  const qs = index.byConcept.get(conceptId) ?? [];
  const runner = qs.filter((q) => q.type === 'mcq' && runnerFit(q)).length;
  const slice = qs.filter((q) => q.type === 'slice').length;
  const room = qs.filter((q) => q.type === 'order' || q.type === 'code' || q.type === 'explain' || (q.type === 'mcq' && q.format === 'scenario')).length;
  return (
    <div className="appears">
      <span className="fb-label">Shows up in</span>
      <div className="row">
        <span className="chip">Lane Runner · {runner}</span>
        <span className="chip">Fruit Slice · {slice}</span>
        <span className="chip">Escape Room · {room}</span>
      </div>
    </div>
  );
}
