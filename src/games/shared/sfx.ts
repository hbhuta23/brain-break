/**
 * Tiny synthesized sound effects (Web Audio). No audio files to license or load.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.12, when = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, freq: number, q: number, gain = 0.2, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  correct() {
    tone(660, 0.12, 'square', 0.07);
    tone(990, 0.18, 'square', 0.07, 0.08);
  },
  wrong() {
    tone(180, 0.28, 'sawtooth', 0.09, 0, 90);
  },
  lane() {
    tone(420, 0.05, 'triangle', 0.05, 0, 560);
  },
  whoosh() {
    noise(0.22, 1800, 1.2, 0.12, 'bandpass', 600);
  },
  slice() {
    noise(0.13, 4200, 0.9, 0.22, 'highpass', 7000);
    tone(1300, 0.08, 'triangle', 0.04, 0, 900);
  },
  splat() {
    noise(0.18, 500, 0.8, 0.25, 'lowpass', 160);
  },
  launch() {
    tone(220, 0.16, 'sine', 0.06, 0, 420);
  },
  strike() {
    tone(240, 0.16, 'square', 0.07, 0, 160);
    tone(160, 0.22, 'square', 0.07, 0.12, 110);
  },
  combo(n: number) {
    for (let i = 0; i < Math.min(n, 5); i++) tone(520 + i * 130, 0.1, 'square', 0.05, i * 0.06);
  },
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.06, i * 0.11));
  },
};
