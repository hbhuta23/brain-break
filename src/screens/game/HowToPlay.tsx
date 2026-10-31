import { FruitSliceThumb, LaneRunnerThumb } from '../../components/Thumbs';

/** First-time instructions. Not everyone grew up playing these games. */
export function HowToPlay({ game, onStart, onBack }: { game: 'lane-runner' | 'fruit-slice'; onStart: () => void; onBack: () => void }) {
  const runner = game === 'lane-runner';
  return (
    <div className="howto page">
      <div className="panel howto-card pop-in">
        <div className="howto-art">{runner ? <LaneRunnerThumb /> : <FruitSliceThumb />}</div>
        <div className="howto-body stack">
          <span className="sticker">How to play</span>
          <h1 className="display">{runner ? 'Lane Runner' : 'Fruit Slice'}</h1>
          {runner ? (
            <ol className="howto-steps">
              <li>A question appears at the top. Three gates come down the tunnel, one per lane.</li>
              <li>
                Switch lanes with <span className="kbd">←</span> <span className="kbd">→</span>, the number keys, a swipe, or by tapping an
                answer.
              </li>
              <li>Run through the right gate. Get a streak and the tunnel speeds up. Miss and it slows down and explains why.</li>
            </ol>
          ) : (
            <ol className="howto-steps">
              <li>The sign at the top names one concept.</li>
              <li>Fruit fly up carrying examples. Swipe through the ones that are examples of that concept.</li>
              <li>
                Let the others fall: they're examples of look-alike concepts. Slicing one costs a strike, and the game stops to show the
                difference.
              </li>
              <li>
                No mouse? Press the <span className="kbd">number</span> on a fruit's tag to slice it.
              </li>
            </ol>
          )}
          <div className="row">
            <button className="btn green big" autoFocus onClick={onStart}>
              Let's go
            </button>
            <button className="linkish" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
