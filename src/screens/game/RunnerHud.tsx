import { useEffect, useState } from 'react';
import type { Bridge, BridgeEvents } from '../../games/shared/bridge';
import type { RunnerItem } from '../../engine/scheduler';

const LANE_KEYS = ['←', '↑', '→'];

/**
 * DOM overlay for Lane Runner. The question and options live here as real
 * text (readable at any size, works with the text-size setting and screen
 * readers). The gates in the tunnel repeat the same options.
 */
export function RunnerHud({ bridge, practice, walk, onQuit }: { bridge: Bridge; practice: boolean; walk: boolean; onQuit: () => void }) {
  const [q, setQ] = useState<{ index: number; total: number; item: RunnerItem } | null>(null);
  const [lane, setLane] = useState(0);
  const [stats, setStats] = useState<BridgeEvents['runner:stats'] | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    const offs = [
      bridge.on('runner:question', (e) => setQ(e)),
      bridge.on('runner:lane', ({ lane }) => setLane(lane)),
      bridge.on('runner:stats', (s) => setStats(s)),
      bridge.on('runner:answer', ({ option, item }) => {
        setQ(null);
        // Correct answers get a short, non-blocking "why" (Hattie & Timperley: feedback about the task, not just ✓).
        if (option.correct) setToast({ id: Date.now(), text: item.explanation });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [bridge]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="hud">
      <div className="hud-top">
        <button className="hud-quit" onClick={onQuit} aria-label="Quit run">
          ✕
        </button>
        <div className="hud-stat">
          <span className="hud-k">Distance</span>
          <span className="hud-v display">{(stats?.distance ?? 0).toLocaleString()}m</span>
        </div>
        <div className="hud-stat">
          <span className="hud-k">Streak</span>
          <span className={`hud-v display ${stats && stats.streak >= 3 ? 'hot' : ''}`}>{stats?.streak ?? 0}</span>
        </div>
        <div className="spacer" />
        {walk || practice ? <span className="chip blue">Walk mode</span> : <span className="chip">Lvl {stats?.level ?? 1}</span>}
        {q && (
          <span className="chip yellow">
            {practice ? 'Practice' : 'Q'} {q.index + 1}/{q.total}
          </span>
        )}
      </div>

      <div className="runner-q" aria-live="polite">
        {q ? (
          <div className="runner-card pop-in" key={q.item.cardId}>
            <p className="runner-stem">{q.item.stem}</p>
            <div className="runner-opts">
              {q.item.options.map((o, i) => (
                <button
                  key={o.text}
                  className={`runner-opt ${lane === i - 1 ? 'on' : ''}`}
                  onClick={() => bridge.emit('move-lane', { lane: i - 1 })}
                  aria-pressed={lane === i - 1}
                >
                  <span className="kbd">{i + 1}</span>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {toast && (
        <div className="runner-toast pop-in" key={toast.id} role="status">
          <strong>✓ Nice.</strong> {toast.text}
        </div>
      )}

      <div className="hud-hint">
        <span className="kbd">{LANE_KEYS[0]}</span> <span className="kbd">{LANE_KEYS[2]}</span> or <span className="kbd">1</span>
        <span className="kbd">2</span>
        <span className="kbd">3</span> to switch lanes · swipe or tap a side on touch
      </div>
    </div>
  );
}
