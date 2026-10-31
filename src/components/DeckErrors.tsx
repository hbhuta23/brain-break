import { useState } from 'react';
import { deckResults } from '../content/decks';

/** Lists deck files that failed validation, so authoring mistakes are obvious. */
export function DeckErrors() {
  const [open, setOpen] = useState(true);
  const bad = deckResults.filter((r) => r.errors);
  if (!bad.length || !open) return null;
  return (
    <div role="alert" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100, maxWidth: 520, maxHeight: '60vh', overflow: 'auto' }} className="panel">
      <div className="row">
        <strong className="display" style={{ color: 'var(--red)' }}>
          Deck problems
        </strong>
        <span className="spacer" />
        <button className="linkish" onClick={() => setOpen(false)}>
          Dismiss
        </button>
      </div>
      {bad.map((r) => (
        <div key={r.file} style={{ marginTop: 10 }}>
          <code>src/content/decks/{r.file}</code> was skipped:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.85rem' }}>
            {r.errors!.slice(0, 25).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {r.errors!.length > 25 && <li>…and {r.errors!.length - 25} more (run npm run validate-deck)</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
