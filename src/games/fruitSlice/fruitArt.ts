/**
 * Procedurally painted fruit, cut halves, juice splats and the wooden dojo
 * wall, all drawn with Canvas 2D at load time. Original art in the spirit of
 * Fruit Ninja; no external assets.
 */
import type Phaser from 'phaser';

export const FRUITS = ['watermelon', 'orange', 'apple', 'kiwi', 'lemon', 'plum'] as const;
export type Fruit = (typeof FRUITS)[number];

export const JUICE: Record<Fruit, number> = {
  watermelon: 0xe2263a,
  orange: 0xff9a1f,
  apple: 0xf3e3b0,
  kiwi: 0x86c440,
  lemon: 0xf6e04b,
  plum: 0xb4134f,
};

/** Texture radius in px. Sprites are scaled down to the on-screen radius. */
export const R = 72;
const SIZE = R * 2 + 16;
const C = SIZE / 2;

function canvas(w = SIZE, h = SIZE) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function outline(ctx: CanvasRenderingContext2D, color = 'rgba(0,0,0,0.55)', w = 4) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function shine(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.45) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
  ctx.restore();
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, len: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.35, 0, 0);
  ctx.fillStyle = '#4caf50';
  ctx.fill();
  outline(ctx, '#1f5d27', 3);
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.strokeStyle = 'rgba(20,70,25,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ whole

function drawWhole(ctx: CanvasRenderingContext2D, f: Fruit) {
  const r = R;
  const rand = rng(f.length * 97);
  ctx.save();
  switch (f) {
    case 'watermelon': {
      ctx.beginPath();
      ctx.ellipse(C, C, r, r * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = radial(ctx, C, C, r, [
        [0, '#5fbf4a'],
        [0.7, '#2f8a3a'],
        [1, '#1d5e25'],
      ]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#174d1e';
      ctx.lineWidth = 9;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        for (let y = -r; y <= r; y += 6) {
          const x = C + i * 22 + Math.sin(y * 0.12 + i) * 5 + (y / r) * i * 4;
          y === -r ? ctx.moveTo(x, C + y) : ctx.lineTo(x, C + y);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(C, C, r, r * 0.9, 0, 0, Math.PI * 2);
      outline(ctx, '#0f3313', 5);
      shine(ctx, C - r * 0.4, C - r * 0.42, r * 0.28, r * 0.12, 0.35);
      break;
    }
    case 'orange':
    case 'lemon': {
      const lemon = f === 'lemon';
      ctx.beginPath();
      if (lemon) {
        ctx.ellipse(C, C, r * 0.98, r * 0.78, -0.35, 0, Math.PI * 2);
      } else ctx.arc(C, C, r * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = lemon
        ? radial(ctx, C, C, r, [
            [0, '#fff6a8'],
            [0.6, '#f6d924'],
            [1, '#c9a400'],
          ])
        : radial(ctx, C, C, r, [
            [0, '#ffc979'],
            [0.55, '#ff8a1f'],
            [1, '#c25600'],
          ]);
      ctx.fill();
      // dimpled peel
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 160; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * r;
        ctx.fillStyle = `rgba(${lemon ? '150,120,0' : '140,60,0'},${0.12 + rand() * 0.15})`;
        ctx.beginPath();
        ctx.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, 1.4 + rand() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      if (lemon) ctx.ellipse(C, C, r * 0.98, r * 0.78, -0.35, 0, Math.PI * 2);
      else ctx.arc(C, C, r * 0.92, 0, Math.PI * 2);
      outline(ctx, lemon ? '#7a6200' : '#7a3300', 5);
      if (lemon) {
        ctx.beginPath();
        ctx.ellipse(C + r * 0.9, C - r * 0.33, 9, 6, -0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#e0bf10';
        ctx.fill();
        outline(ctx, '#7a6200', 3);
      } else {
        leaf(ctx, C + 2, C - r * 0.88, -0.5, 34);
        ctx.beginPath();
        ctx.arc(C, C - r * 0.86, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#5b3a1a';
        ctx.fill();
      }
      shine(ctx, C - r * 0.35, C - r * 0.38, r * 0.26, r * 0.13);
      break;
    }
    case 'apple': {
      ctx.beginPath();
      ctx.moveTo(C, C - r * 0.62);
      ctx.bezierCurveTo(C + r * 0.6, C - r * 1.05, C + r * 1.15, C - r * 0.3, C + r * 0.85, C + r * 0.45);
      ctx.bezierCurveTo(C + r * 0.65, C + r * 0.98, C + r * 0.2, C + r * 0.95, C, C + r * 0.82);
      ctx.bezierCurveTo(C - r * 0.2, C + r * 0.95, C - r * 0.65, C + r * 0.98, C - r * 0.85, C + r * 0.45);
      ctx.bezierCurveTo(C - r * 1.15, C - r * 0.3, C - r * 0.6, C - r * 1.05, C, C - r * 0.62);
      ctx.closePath();
      ctx.fillStyle = radial(ctx, C, C, r * 1.05, [
        [0, '#ff6b6b'],
        [0.55, '#d81e2c'],
        [1, '#7d0a14'],
      ]);
      ctx.fill();
      outline(ctx, '#4a0409', 5);
      ctx.beginPath();
      ctx.moveTo(C, C - r * 0.6);
      ctx.quadraticCurveTo(C + 4, C - r * 0.95, C + 12, C - r * 1.05);
      ctx.strokeStyle = '#4b2c12';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      leaf(ctx, C + 8, C - r * 0.9, -0.3, 30);
      shine(ctx, C - r * 0.42, C - r * 0.22, r * 0.2, r * 0.1, 0.5);
      break;
    }
    case 'kiwi': {
      ctx.beginPath();
      ctx.ellipse(C, C, r * 0.98, r * 0.8, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = radial(ctx, C, C, r, [
        [0, '#a77b4f'],
        [0.65, '#7a5530'],
        [1, '#4d3219'],
      ]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 420; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * r;
        const x = C + Math.cos(a) * d;
        const y = C + Math.sin(a) * d;
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? '40,25,10' : '200,170,120'},0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 6, y + (rand() - 0.5) * 6);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(C, C, r * 0.98, r * 0.8, 0.2, 0, Math.PI * 2);
      outline(ctx, '#2e1c0b', 5);
      shine(ctx, C - r * 0.4, C - r * 0.35, r * 0.22, r * 0.09, 0.25);
      break;
    }
    case 'plum': {
      ctx.beginPath();
      ctx.ellipse(C, C + 2, r * 0.86, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fillStyle = radial(ctx, C, C, r, [
        [0, '#b06ad8'],
        [0.55, '#6c2a9c'],
        [1, '#33104f'],
      ]);
      ctx.fill();
      outline(ctx, '#1d0630', 5);
      // seam
      ctx.beginPath();
      ctx.moveTo(C + 4, C - r * 0.85);
      ctx.quadraticCurveTo(C + r * 0.35, C, C + 6, C + r * 0.9);
      ctx.strokeStyle = 'rgba(30,5,50,0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();
      leaf(ctx, C + 2, C - r * 0.86, -0.9, 28);
      shine(ctx, C - r * 0.35, C - r * 0.4, r * 0.24, r * 0.12, 0.4);
      // bloom dusting
      ctx.fillStyle = 'rgba(220,200,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(C, C + 2, r * 0.8, r * 0.86, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ cross-section

function drawCut(ctx: CanvasRenderingContext2D, f: Fruit) {
  const r = R * 0.92;
  const rand = rng(f.length * 31 + 7);
  const disc = (rad: number, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.arc(C, C, rad, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  switch (f) {
    case 'watermelon':
      disc(r, '#2f8a3a');
      disc(r * 0.9, '#d8efb8');
      disc(r * 0.82, radial(ctx, C, C, r * 0.82, [
        [0, '#ff6b78'],
        [1, '#e2263a'],
      ]));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + rand() * 0.2;
        const d = r * (0.42 + rand() * 0.25);
        ctx.save();
        ctx.translate(C + Math.cos(a) * d, C + Math.sin(a) * d);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.4, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1b1b1b';
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'orange':
    case 'lemon': {
      const lemon = f === 'lemon';
      disc(r, lemon ? '#e8c51a' : '#f07a12');
      disc(r * 0.88, lemon ? '#fdf7d8' : '#fff1d6');
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + 0.06;
        const a1 = ((i + 1) / n) * Math.PI * 2 - 0.06;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos((a0 + a1) / 2) * 6, C + Math.sin((a0 + a1) / 2) * 6);
        ctx.arc(C, C, r * 0.8, a0, a1);
        ctx.closePath();
        ctx.fillStyle = radial(ctx, C, C, r * 0.8, lemon
          ? [[0, '#fff7b0'], [1, '#f4dc3a']]
          : [[0, '#ffc05a'], [1, '#ff8a1f']]);
        ctx.fill();
      }
      break;
    }
    case 'apple':
      disc(r, '#c81d2a');
      disc(r * 0.92, radial(ctx, C, C, r, [
        [0, '#fffbe8'],
        [1, '#f1dfa6'],
      ]));
      ctx.strokeStyle = 'rgba(160,120,60,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(C, C, r * 0.32, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.save();
        ctx.translate(C + Math.cos(a) * r * 0.2, C + Math.sin(a) * r * 0.2);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.5, 7, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#5a3412';
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'kiwi':
      disc(r, '#6b4a28');
      disc(r * 0.93, radial(ctx, C, C, r, [
        [0, '#d9f08a'],
        [0.5, '#8fcf3c'],
        [1, '#5f9e22'],
      ]));
      disc(r * 0.3, '#f4f7d9');
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        ctx.save();
        ctx.translate(C + Math.cos(a) * r * 0.42, C + Math.sin(a) * r * 0.42);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'plum':
      disc(r, '#4a1a6e');
      disc(r * 0.92, radial(ctx, C, C, r, [
        [0, '#ffd27a'],
        [1, '#e89a2b'],
      ]));
      ctx.beginPath();
      ctx.ellipse(C, C, r * 0.26, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#8a4b1c';
      ctx.fill();
      break;
  }
  ctx.beginPath();
  ctx.arc(C, C, r, 0, Math.PI * 2);
  outline(ctx, 'rgba(0,0,0,0.5)', 4);
}

/** Half a fruit: the cut face (seen from the front) plus skin, clipped to one side of the cut line. */
function drawHalf(ctx: CanvasRenderingContext2D, f: Fruit, top: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top ? 0 : C, SIZE, C);
  ctx.clip();
  drawCut(ctx, f);
  ctx.restore();
  // a little skin lip along the cut, so halves read as 3D
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(C - R * 0.92, top ? C - 3 : C, R * 1.84, 3);
}

function drawSplat(ctx: CanvasRenderingContext2D, seed: number) {
  const rand = rng(seed);
  ctx.fillStyle = '#fff';
  const S = 128;
  ctx.beginPath();
  ctx.arc(S, S, 40, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const d = 38 + rand() * 60;
    ctx.beginPath();
    ctx.arc(S + Math.cos(a) * d, S + Math.sin(a) * d, 3 + rand() * 12, 0, Math.PI * 2);
    ctx.fill();
    if (rand() > 0.5) {
      ctx.beginPath();
      ctx.moveTo(S, S);
      ctx.lineTo(S + Math.cos(a) * d, S + Math.sin(a) * d);
      ctx.lineWidth = 6 + rand() * 10;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  // drips
  for (let i = 0; i < 4; i++) {
    const x = S - 30 + rand() * 60;
    const len = 30 + rand() * 70;
    ctx.fillRect(x - 3, S, 6, len);
    ctx.beginPath();
    ctx.arc(x, S + len, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWood(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = rng(4242);
  const browns = ['#5d3b22', '#6b452a', '#56361f', '#634026', '#4f321c'];
  let y = 0;
  let i = 0;
  while (y < h) {
    const ph = 130 + rand() * 60;
    ctx.fillStyle = browns[i % browns.length];
    ctx.fillRect(0, y, w, ph);
    // grain
    for (let k = 0; k < 26; k++) {
      const gy = y + rand() * ph;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 40) ctx.lineTo(x, gy + Math.sin(x * 0.006 + k) * 5 + (rand() - 0.5) * 2);
      ctx.strokeStyle = `rgba(30,15,5,${0.08 + rand() * 0.14})`;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.stroke();
    }
    // lighter streaks
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(255,220,170,${0.02 + rand() * 0.03})`;
      ctx.fillRect(0, y + rand() * ph, w, 2 + rand() * 6);
    }
    // knots
    for (let k = 0; k < 2; k++) {
      const kx = rand() * w;
      const ky = y + ph * (0.3 + rand() * 0.4);
      for (let ring = 0; ring < 5; ring++) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, 26 - ring * 4.5, 10 - ring * 1.7, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(30,15,5,${0.18 + ring * 0.05})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // plank seams with highlight
    ctx.fillStyle = '#1e1007';
    ctx.fillRect(0, y + ph - 4, w, 4);
    ctx.fillStyle = 'rgba(255,220,170,0.08)';
    ctx.fillRect(0, y + ph, w, 2);
    // nails
    for (const nx of [w * 0.12, w * 0.88]) {
      ctx.beginPath();
      ctx.arc(nx + (rand() - 0.5) * 40, y + ph / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#2b1a0e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(nx - 1, y + ph / 2 - 1, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
    y += ph;
    i++;
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, s: number) {
  const g = ctx.createRadialGradient(s / 2, s * 0.45, s * 0.2, s / 2, s / 2, s * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

/** Register every texture the scene needs. Safe to call more than once. */
export function makeFruitTextures(textures: Phaser.Textures.TextureManager) {
  const add = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (textures.exists(key)) return;
    const [c, ctx] = canvas(w, h);
    draw(ctx);
    textures.addCanvas(key, c);
  };
  for (const f of FRUITS) {
    add(`fruit-${f}`, SIZE, SIZE, (ctx) => drawWhole(ctx, f));
    add(`half-${f}-a`, SIZE, SIZE, (ctx) => drawHalf(ctx, f, true));
    add(`half-${f}-b`, SIZE, SIZE, (ctx) => drawHalf(ctx, f, false));
  }
  for (let i = 0; i < 3; i++) add(`splat-${i}`, 256, 256, (ctx) => drawSplat(ctx, 11 + i * 13));
  add('wood', 1400, 1000, (ctx) => drawWood(ctx, 1400, 1000));
  add('vignette', 512, 512, (ctx) => drawVignette(ctx, 512));
  add('droplet', 24, 24, (ctx) => {
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
}
