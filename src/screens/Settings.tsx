import { useState } from 'react';
import { useNavigate } from 'react-router';
import { decks } from '../content/decks';
import { dayToIso, formatDay } from '../engine/clock';
import { eventsToCsv } from '../engine/events';
import { useApp, type Settings as S } from '../store/useApp';
import './settings.css';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="set-row">
      <div>
        <strong>{label}</strong>
        <p className="muted">{hint}</p>
      </div>
      <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
        <span />
      </button>
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const s = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const answers = s.events.filter((e) => e.type === 'answer').length;
  const sessions = s.events.filter((e) => e.type === 'session-end').length;
  const set = (patch: Partial<S>) => s.updateSettings(patch);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="set page">
      <h1 className="display set-title">Settings</h1>

      <section className="panel set-sec">
        <h2 className="display">Comfort &amp; access</h2>
        <div className="set-row">
          <div>
            <strong>Text size</strong>
            <p className="muted">Applies everywhere, including fruit tags.</p>
          </div>
          <div className="seg" role="radiogroup" aria-label="Text size">
            {([1, 1.15, 1.3] as const).map((v) => (
              <button key={v} role="radio" aria-checked={s.settings.textScale === v} className={s.settings.textScale === v ? 'on' : ''} onClick={() => set({ textScale: v })}>
                {Math.round(v * 100)}%
              </button>
            ))}
          </div>
        </div>
        <Toggle
          on={s.settings.walkMode}
          onChange={(v) => set({ walkMode: v })}
          label="Walk mode"
          hint="Lane Runner stays slow and steady, and fruit hang in the air longer. Speed never affects your mastery."
        />
        <Toggle on={s.settings.reducedMotion} onChange={(v) => set({ reducedMotion: v })} label="Reduce motion" hint="No screen shake, fewer particles, gentler animations." />
        <Toggle on={s.settings.sound} onChange={(v) => set({ sound: v })} label="Sound effects" hint="Bleeps, swooshes and splats." />
      </section>

      <section className="panel set-sec">
        <h2 className="display">Your study</h2>
        <div className="set-row">
          <div>
            <strong>Next quiz or exam</strong>
            <p className="muted">Reviews get pulled in so they land before this date.</p>
          </div>
          <div className="row">
            <input type="date" className="set-date" value={s.examDate ?? ''} min={dayToIso(s.today())} onChange={(e) => s.setExamDate(e.target.value || null)} aria-label="Quiz date" />
            {s.examDate && (
              <button className="linkish" onClick={() => s.setExamDate(null)}>
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="set-row">
          <div>
            <strong>Deck</strong>
            <p className="muted">Progress is kept separately for each deck.</p>
          </div>
          <select className="set-select" value={s.deckId ?? ''} onChange={(e) => s.setDeck(e.target.value)} aria-label="Deck">
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
        <div className="set-row">
          <div>
            <strong>Pretest</strong>
            <p className="muted">Retake it to re-place cards (useful after switching decks).</p>
          </div>
          <button className="btn small ghost" onClick={() => navigate('/pretest')}>
            Take pretest
          </button>
        </div>
      </section>

      <section className="panel set-sec demo">
        <h2 className="display">
          Demo tools <span className="sticker">for testers</span>
        </h2>
        <p className="muted">
          Spacing happens over days, and nobody trying the app wants to wait a week. These let you jump ahead and watch missed questions come back.
        </p>
        <div className="set-row">
          <div>
            <strong>App date: {formatDay(s.today())}</strong>
            <p className="muted">{s.dayOffset ? `${s.dayOffset} day${s.dayOffset === 1 ? '' : 's'} ahead of real time.` : 'Matches real time.'}</p>
          </div>
          <div className="row">
            <button className="btn small" onClick={s.skipDay}>
              Skip a day ⏭
            </button>
            {s.dayOffset > 0 && (
              <button className="btn small ghost" onClick={s.resetDemoClock}>
                Back to today
              </button>
            )}
          </div>
        </div>
        <Toggle on={s.freePlayUnlocked} onChange={s.setFreePlayUnlocked} label="Unlock free play now" hint="Normally the arcade opens after your first week." />
      </section>

      <section className="panel set-sec">
        <h2 className="display">Your data</h2>
        <p>
          Brain Break records every answer (what you picked, if it was right, how long it took), hints, confidence ratings and when you played. It's used to
          schedule your reviews and, if you take part in the study, to evaluate whether the games help. Nothing leaves this browser unless you export it.
        </p>
        <div className="row">
          <span className="chip">{answers} answers</span>
          <span className="chip">{sessions} sessions</span>
          <span className="chip">{s.events.length} events total</span>
        </div>
        <div className="row">
          <button className="btn small blue" onClick={() => download(`brain-break-${stamp}.csv`, eventsToCsv(s.events), 'text/csv')}>
            Export CSV
          </button>
          <button
            className="btn small ghost"
            onClick={() =>
              download(
                `brain-break-${stamp}.json`,
                JSON.stringify({ exportedAt: new Date().toISOString(), deckId: s.deckId, examDate: s.examDate, dayOffset: s.dayOffset, progress: s.progress, events: s.events }, null, 2),
                'application/json',
              )
            }
          >
            Export JSON
          </button>
          <span className="spacer" />
          {confirmDelete ? (
            <>
              <span className="muted">This wipes all progress. Sure?</span>
              <button
                className="btn small red"
                onClick={() => {
                  s.resetAll();
                  navigate('/welcome');
                }}
              >
                Yes, delete everything
              </button>
              <button className="linkish" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn small red" onClick={() => setConfirmDelete(true)}>
              Delete my data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
