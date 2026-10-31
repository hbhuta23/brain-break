import { useEffect, useState } from 'react';
import type { Bridge, BridgeEvents } from '../../games/shared/bridge';
import type { SlicePlan } from '../../engine/scheduler';

/** "Slice every source of EXTRANEOUS load" -> ["Slice every", "source of EXTRANEOUS load"] */
function splitPrompt(prompt: string): [string, string] {
  const m = prompt.match(/^(slice (?:every|all|each)(?: example of)?)\s+(.*)$/i);
  return m ? [m[1], m[2]] : ['', prompt];
}

export function SliceHud({ bridge, onQuit }: { bridge: Bridge; plan: SlicePlan; onQuit: () => void }) {
  const [wave, setWave] = useState<BridgeEvents['slice:wave'] | null>(null);
  const [stats, setStats] = useState<BridgeEvents['slice:stats']>({ score: 0, strikes: 0, combo: 0 });

  useEffect(() => {
    const offs = [bridge.on('slice:wave', setWave), bridge.on('slice:stats', setStats)];
    return () => offs.forEach((o) => o());
  }, [bridge]);

  return (
    <div className="hud">
      <div className="hud-top">
        <button className="hud-quit" onClick={onQuit} aria-label="Quit">
          ✕
        </button>
        <div className="slice-score display" aria-label={`Score ${stats.score}`}>
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
            <path d="M4 20 A16 16 0 0 0 36 20 Z" fill="#2f8a3a" stroke="#000" strokeWidth="2.5" />
            <path d="M8 20 A12 12 0 0 0 32 20 Z" fill="#ef3b4f" />
            <circle cx="14" cy="25" r="1.6" fill="#111" />
            <circle cx="20" cy="28" r="1.6" fill="#111" />
            <circle cx="26" cy="25" r="1.6" fill="#111" />
          </svg>
          {stats.score}
        </div>
        <div className="spacer" />
        <div className="strikes display" aria-label={`${stats.strikes} of 3 strikes`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stats.strikes ? 'on' : ''}>
              X
            </span>
          ))}
        </div>
      </div>

      {wave && (
        <div className="slice-sign pop-in" key={wave.index} aria-live="polite">
          <span className="sign-rope" aria-hidden="true" />
          <div className="sign-board">
            <span className="sign-small">
              Wave {wave.index + 1}/{wave.total} · {wave.wave.conceptName}
            </span>
            {splitPrompt(wave.wave.prompt)[0] && <span className="sign-do">{splitPrompt(wave.wave.prompt)[0]}</span>}
            <span className="sign-target display">{splitPrompt(wave.wave.prompt)[1]}</span>
          </div>
        </div>
      )}

      <div className="hud-hint">Swipe through a fruit (or its tag) to slice · or press the number on its tag · let the others fall</div>
    </div>
  );
}
