/**
 * Cover art for each game card. Hand-built SVG, drawn with the same
 * projection the games use so the thumbnails match what you play.
 */
import { useMemo } from 'react';

type Pt = [number, number];
const poly = (pts: Pt[]) => pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');

function hash(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function mix(c1: number[], c2: number[], t: number) {
  return `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(',')})`;
}

export function LaneRunnerThumb() {
  const shapes = useMemo(() => {
    const W = 320, cx = 160, cy = 84, f = 150, camY = 1.25, camX = 0.15;
    const P = (x: number, y: number, z: number): Pt => [cx + ((x - camX) * f) / z, cy - ((y - camY) * f) / z];
    const tile = [92, 112, 150], bg = [5, 6, 13];
    const out: { pts: string; fill: string }[] = [];
    const D = 1.4;
    for (let k = 22; k >= 0; k--) {
      const z0 = Math.max(0.55, k * D + 0.3), z1 = (k + 1) * D + 0.3;
      if (z1 <= 0.55) continue;
      const fog = Math.min(1, (z0 / 30) ** 0.8);
      const ins = 0.05;
      const faces: [number, number, (a: number, b: number, z: number) => Pt, number][] = [
        // [from, to, map(u, v, z), shade]
        [-1.5, 1.5, (u, _v, z) => P(u, 0, z), 1],
        [0, 3, (u, _v, z) => P(-1.5, u, z), 0.72],
        [0, 3, (u, _v, z) => P(1.5, u, z), 0.72],
        [-1.5, 1.5, (u, _v, z) => P(u, 3, z), 0.5],
      ];
      faces.forEach(([a, b, map, shade], fi) => {
        for (let t = 0; t < 3; t++) {
          const u0 = a + ((b - a) / 3) * t + ins, u1 = a + ((b - a) / 3) * (t + 1) - ins;
          if (fi > 0 && hash(k, fi * 3 + t) < 0.16) continue; // Run 3 style holes in walls and ceiling
          const v = 0.86 + hash(k + 9, t + fi) * 0.14;
          const base = tile.map((c) => c * shade * v);
          out.push({
            pts: poly([map(u0, 0, z0 + ins), map(u1, 0, z0 + ins), map(u1, 0, z1 - ins), map(u0, 0, z1 - ins)]),
            fill: mix(base, bg, fog),
          });
        }
      });
      if (k === 6) {
        // a row of answer gates
        ['A', 'B', 'C'].forEach((_, i) => {
          const x0 = -1.5 + i + 0.08, x1 = -1.5 + i + 0.92, z = 6 * D + 0.3;
          out.push({ pts: poly([P(x0, 0.1, z), P(x1, 0.1, z), P(x1, 1.35, z), P(x0, 1.35, z)]), fill: 'rgba(56,182,255,0.28)' });
        });
      }
    }
    return { out, W };
  }, []);

  return (
    <svg viewBox="0 0 320 200" className="thumb" role="img" aria-label="Lane Runner: a little alien running down a tiled tunnel in space">
      <rect width="320" height="200" fill="#05060d" />
      {Array.from({ length: 70 }, (_, i) => (
        <circle key={i} cx={hash(i, 1) * 320} cy={hash(i, 2) * 200} r={hash(i, 3) * 1.1 + 0.3} fill="#fff" opacity={0.3 + hash(i, 4) * 0.6} />
      ))}
      {shapes.out.map((s, i) => (
        <polygon key={i} points={s.pts} fill={s.fill} />
      ))}
      {/* gate frames */}
      <g fill="none" stroke="#7fd3ff" strokeWidth="1.6">
        {[0, 1, 2].map((i) => {
          const z = 6 * 1.4 + 0.3, f = 150, cx = 160, cy = 84;
          const X = (x: number) => cx + ((x - 0.15) * f) / z;
          const Y = (y: number) => cy - ((y - 1.25) * f) / z;
          const x0 = -1.5 + i + 0.08, x1 = -1.5 + i + 0.92;
          return <rect key={i} x={X(x0)} y={Y(1.35)} width={X(x1) - X(x0)} height={Y(0.1) - Y(1.35)} rx="2" />;
        })}
      </g>
      {/* alien runner, seen from behind */}
      <g transform="translate(160 182)">
        <ellipse cx="0" cy="4" rx="20" ry="5" fill="#000" opacity=".45" />
        <path d="M-8 -6 L-12 4 M8 -6 L11 2" stroke="#2a2d3a" strokeWidth="7" strokeLinecap="round" />
        <path d="M-8 -6 L-12 4 M8 -6 L11 2" stroke="#b9bdca" strokeWidth="4" strokeLinecap="round" />
        <rect x="-10" y="-30" width="20" height="26" rx="9" fill="#b9bdca" stroke="#2a2d3a" strokeWidth="2.5" />
        <path d="M-10 -24 L-19 -12 M10 -24 L18 -32" stroke="#2a2d3a" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M-10 -24 L-19 -12 M10 -24 L18 -32" stroke="#b9bdca" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="0" cy="-44" rx="17" ry="15" fill="#c6cad6" stroke="#2a2d3a" strokeWidth="2.5" />
        <path d="M-9 -55 Q -13 -66 -17 -67 M9 -55 Q 13 -66 17 -67" stroke="#2a2d3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="-17" cy="-67" r="3" fill="var(--yellow)" stroke="#2a2d3a" strokeWidth="1.6" />
        <circle cx="17" cy="-67" r="3" fill="var(--yellow)" stroke="#2a2d3a" strokeWidth="1.6" />
        <path d="M-9 -50 Q -4 -56 3 -56" stroke="#fff" strokeOpacity=".6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function FruitSliceThumb() {
  const planks = [
    { y: 0, h: 44, c: '#5d3b22' },
    { y: 44, h: 52, c: '#6b452a' },
    { y: 96, h: 40, c: '#56361f' },
    { y: 136, h: 64, c: '#664127' },
  ];
  return (
    <svg viewBox="0 0 320 200" className="thumb" role="img" aria-label="Fruit Slice: a watermelon sliced in half over a wooden wall">
      <defs>
        <radialGradient id="fs-vig" cx="50%" cy="45%" r="70%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity=".55" />
        </radialGradient>
        <radialGradient id="fs-orange" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffc46b" />
          <stop offset=".55" stopColor="#ff8a1f" />
          <stop offset="1" stopColor="#c45a00" />
        </radialGradient>
        <linearGradient id="fs-blade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      {planks.map((p, i) => (
        <g key={i}>
          <rect y={p.y} width="320" height={p.h} fill={p.c} />
          <rect y={p.y + p.h - 3} width="320" height="3" fill="#2a170a" opacity=".7" />
          {Array.from({ length: 5 }, (_, j) => (
            <path
              key={j}
              d={`M0 ${p.y + 6 + j * (p.h / 5.5)} C 80 ${p.y + 2 + j * (p.h / 5.5)}, 200 ${p.y + 10 + j * (p.h / 5.5)}, 320 ${p.y + 5 + j * (p.h / 5.5)}`}
              stroke="#2a170a"
              strokeOpacity=".22"
              strokeWidth="1.2"
              fill="none"
            />
          ))}
        </g>
      ))}
      {/* juice splats on the wall */}
      <g fill="#e2263a" opacity=".55">
        <circle cx="118" cy="92" r="26" />
        <circle cx="146" cy="76" r="9" />
        <circle cx="95" cy="118" r="7" />
        <rect x="112" y="110" width="7" height="34" rx="3.5" />
        <rect x="128" y="112" width="5" height="22" rx="2.5" />
      </g>
      <g fill="#ff9a1f" opacity=".5">
        <circle cx="252" cy="150" r="16" />
        <circle cx="272" cy="138" r="5" />
      </g>
      {/* whole orange */}
      <g transform="translate(250 58) rotate(-18)">
        <circle r="27" fill="url(#fs-orange)" stroke="#5a2a00" strokeWidth="2.5" />
        <path d="M-3 -27 q 6 -9 15 -8 q -5 7 -15 8z" fill="#3fa34d" stroke="#1f5d27" strokeWidth="1.5" />
        <ellipse cx="-9" cy="-10" rx="7" ry="4" fill="#fff" opacity=".35" />
      </g>
      {/* watermelon halves, flying apart */}
      <g transform="translate(112 104) rotate(-28)">
        <g transform="translate(-6 -18)">
          <path d="M-40 0 A40 40 0 0 1 40 0 Z" fill="#2f8a3a" stroke="#123d18" strokeWidth="2.5" />
          <path d="M-34 0 A34 34 0 0 1 34 0 Z" fill="#f0f7d9" />
          <path d="M-30 0 A30 30 0 0 1 30 0 Z" fill="#ef3b4f" />
          {[-18, -6, 6, 18, -12, 12].map((x, i) => (
            <ellipse key={i} cx={x} cy={i < 4 ? -10 : -20} rx="2" ry="3.2" fill="#1b1b1b" />
          ))}
        </g>
        <g transform="translate(14 20) rotate(180)">
          <path d="M-40 0 A40 40 0 0 1 40 0 Z" fill="#2f8a3a" stroke="#123d18" strokeWidth="2.5" />
          <path d="M-34 0 A34 34 0 0 1 34 0 Z" fill="#f0f7d9" />
          <path d="M-30 0 A30 30 0 0 1 30 0 Z" fill="#ef3b4f" />
          {[-14, 0, 14].map((x, i) => (
            <ellipse key={i} cx={x} cy="-12" rx="2" ry="3.2" fill="#1b1b1b" />
          ))}
        </g>
      </g>
      {/* blade trail */}
      <path d="M18 168 Q 110 108 236 40 L 240 44 Q 112 116 20 172 Z" fill="url(#fs-blade)" />
      <rect width="320" height="200" fill="url(#fs-vig)" />
      {/* strikes */}
      <g transform="translate(262 22)" fontFamily="Bungee" fontSize="17" stroke="#000" strokeWidth="1.5">
        <text x="0" fill="#ff5964">X</text>
        <text x="17" fill="#ff5964" opacity=".35">X</text>
        <text x="34" fill="#ff5964" opacity=".35">X</text>
      </g>
    </svg>
  );
}

export function EscapeRoomThumb() {
  return (
    <svg viewBox="0 0 320 200" className="thumb" role="img" aria-label="Escape Room: a locked door with a padlock in a dim room">
      <defs>
        <radialGradient id="er-light" cx="50%" cy="30%" r="75%">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".7" />
        </radialGradient>
        <linearGradient id="er-door" x1="0" x2="1">
          <stop offset="0" stopColor="#7a4a26" />
          <stop offset="1" stopColor="#5d3519" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="#3c4a43" />
      {/* wallpaper stripes */}
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={i * 20} width="10" height="128" fill="#36433d" />
      ))}
      <rect y="120" width="320" height="10" fill="#2a211a" />
      <rect y="130" width="320" height="44" fill="#4a3526" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={8 + i * 40} y="136" width="32" height="32" rx="2" fill="none" stroke="#33241a" strokeWidth="2" />
      ))}
      <rect y="168" width="320" height="32" fill="#1e1915" />
      {/* poster */}
      <g transform="translate(36 30) rotate(-3)">
        <rect width="56" height="70" fill="#efe3c4" stroke="#1d1a17" strokeWidth="2.5" />
        <rect x="8" y="8" width="40" height="5" fill="#b94a3d" />
        <rect x="8" y="18" width="32" height="3" fill="#7d7464" />
        <rect x="8" y="25" width="36" height="3" fill="#7d7464" />
        <circle cx="28" cy="48" r="12" fill="none" stroke="#3b6aa0" strokeWidth="3" />
        <path d="M22 48 l4 4 l8 -9" stroke="#3b6aa0" strokeWidth="3" fill="none" />
      </g>
      {/* door */}
      <rect x="196" y="26" width="76" height="142" fill="#2a1a0e" />
      <rect x="200" y="30" width="68" height="138" fill="url(#er-door)" stroke="#1d1209" strokeWidth="2" />
      <rect x="208" y="40" width="52" height="50" rx="3" fill="none" stroke="#3f2410" strokeWidth="2.5" />
      <rect x="208" y="102" width="52" height="56" rx="3" fill="none" stroke="#3f2410" strokeWidth="2.5" />
      {/* padlock */}
      <g transform="translate(255 98)">
        <path d="M-9 0 v-9 a9 9 0 0 1 18 0 v9" fill="none" stroke="#c9ccd4" strokeWidth="4" />
        <rect x="-13" y="-1" width="26" height="22" rx="4" fill="var(--yellow)" stroke="#000" strokeWidth="2.5" />
        <circle cx="0" cy="8" r="3" fill="#000" />
        <rect x="-1.2" y="9" width="2.4" height="6" fill="#000" />
      </g>
      {/* desk with book */}
      <rect x="92" y="122" width="88" height="8" fill="#6a4426" stroke="#1d1209" strokeWidth="2" />
      <rect x="98" y="130" width="6" height="38" fill="#4d311b" />
      <rect x="168" y="130" width="6" height="38" fill="#4d311b" />
      <g transform="translate(118 108) rotate(-6)">
        <rect width="34" height="12" fill="#2f5d8c" stroke="#0e1d2c" strokeWidth="2" />
        <rect x="3" y="3" width="28" height="2" fill="#e8d9b0" />
      </g>
      <rect width="320" height="200" fill="url(#er-light)" />
      {/* classic flash escape UI */}
      <g fill="#fff" stroke="#000" strokeWidth="2" opacity=".9">
        <path d="M14 88 l14 -12 v24 z" />
        <path d="M306 88 l-14 -12 v24 z" />
      </g>
      <g transform="translate(96 176)">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 34} width="28" height="20" rx="3" fill="#0d0f14" stroke="#5c6275" strokeWidth="1.5" />
        ))}
        <path d="M6 10 h8 m-2 0 v4 m-3 -4 v3" stroke="var(--yellow)" strokeWidth="2" />
        <circle cx="6" cy="10" r="3.5" fill="none" stroke="var(--yellow)" strokeWidth="2" />
      </g>
    </svg>
  );
}
