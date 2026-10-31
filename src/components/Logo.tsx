import './logo.css';

export function BrainMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brain-mark">
      <path
        d="M32 9c-10 0-17 7-17 15 0 3 1 5.5 2.2 7.5C15 34 14 36.4 14 39.5 14 47 20.8 53 30 53h4c9.2 0 16-6 16-13.5 0-3.1-1-5.5-3.2-8 1.2-2 2.2-4.5 2.2-7.5 0-8-7-15-17-15z"
        fill="var(--yellow)"
        stroke="#000"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 11v40M23.5 21.5c3.2 1 5.3 3.6 5.3 7M40.5 21.5c-3.2 1-5.3 3.6-5.3 7M21 37.5c3.5.2 6.6-1 8-3.4M43 37.5c-3.5.2-6.6-1-8-3.4"
        stroke="#000"
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M21 16.5c2-2 4.5-3 7-3.2" stroke="#fff" strokeOpacity=".7" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'xl' }) {
  return (
    <span className={`logo logo-${size}`}>
      <BrainMark size={size === 'xl' ? 128 : 38} />
      <span className="logo-words display">
        <span className="logo-brain">Brain</span>
        <span className="logo-break">Break</span>
      </span>
    </span>
  );
}
