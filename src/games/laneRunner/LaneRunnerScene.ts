/**
 * Lane Runner — quick recall (Gagné: verbal information, Bloom: Remember).
 *
 * A homage to Run 3: a little alien runs down a tiled tunnel floating in
 * space. Each question arrives as three gates across the three lanes, and
 * running through a gate *is* the answer (intrinsic integration, Habgood &
 * Ainsworth 2011). Speed adapts toward ~80% accuracy (Rosenshine); walk mode
 * keeps it slow and fixed for anyone who doesn't want the pressure.
 *
 * Rendering is a hand-rolled perspective projection drawn with Graphics.
 * World units: x across (lanes at -1, 0, 1), y up (floor 0, ceiling 3), z ahead.
 */
import Phaser from 'phaser';
import type { Bridge } from '../shared/bridge';
import type { RunnerItem } from '../../engine/scheduler';
import { sfx } from '../shared/sfx';

export interface LaneRunnerData {
  bridge: Bridge;
  items: RunnerItem[];
  practice?: boolean;
}

type RGB = [number, number, number];

const HALF_W = 1.5;
const TUNNEL_H = 3;
const TILE_D = 1.5;
const FAR = 44;
const NEAR = 0.35;
const PLAYER_Z = 2.4;
const GATE_SPAWN_Z = 36;
const CAM_Y = 1.3;
const BG: RGB = [5, 6, 13];

// Tunnel colours cycle as you level up, like Run 3's changing tunnels.
const PALETTES: RGB[] = [
  [96, 114, 152], // steel blue
  [84, 142, 120], // teal
  [158, 116, 84], // copper
  [128, 100, 156], // violet
  [150, 142, 90], // olive gold
];

const SPEED = {
  normal: { start: 3.6, min: 2.8, max: 7.4 },
  walk: { start: 2.5, min: 2.5, max: 2.5 },
};

const FACES = [
  { shade: 1.0, holes: false }, // floor
  { shade: 0.74, holes: true }, // left wall
  { shade: 0.74, holes: true }, // right wall
  { shade: 0.52, holes: true }, // ceiling
] as const;

function hash(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const toInt = (c: RGB) => (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Gate {
  item: RunnerItem;
  /** World z of the gate row. */
  z: number;
  spawnedAt: number;
}

interface Star {
  a: number;
  r: number;
  s: number;
}

export class LaneRunnerScene extends Phaser.Scene {
  private bridge!: Bridge;
  private items: RunnerItem[] = [];
  private practice = false;

  private gBg!: Phaser.GameObjects.Graphics;
  private gTunnel!: Phaser.GameObjects.Graphics;
  private gGate!: Phaser.GameObjects.Graphics;
  private gPlayer!: Phaser.GameObjects.Graphics;
  private gateTexts: Phaser.GameObjects.Text[] = [];
  private flash!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  // projection
  private f = 600;
  private cx = 0;
  private cy = 0;
  private camX = 0;

  // run state
  private dist = 0;
  private speed = SPEED.normal.start;
  private targetSpeed = SPEED.normal.start;
  private range = SPEED.normal;
  private lane = 0;
  private player = { x: 0, hop: 0 };
  private phase = 0;
  private hurtUntil = 0;
  private gate: Gate | null = null;
  private nextSpawnAt = 0;
  private index = 0;
  private answered = 0;
  private correct = 0;
  private streak = 0;
  private recent: boolean[] = [];
  private palette: RGB = PALETTES[0];
  private paletteFrom: RGB = PALETTES[0];
  private paletteTo: RGB = PALETTES[0];
  private paletteT = 1;
  private level = 0;
  private stars: Star[] = [];
  private ended = false;
  private lastStatsAt = 0;
  private reduced = false;
  private unsub: (() => void)[] = [];

  constructor() {
    super('lane-runner');
  }

  init(data: LaneRunnerData) {
    this.bridge = data.bridge;
    this.items = data.items;
    this.practice = !!data.practice;
    this.reduced = data.bridge.settings.reducedMotion;
    this.range = data.bridge.settings.walkMode || this.practice ? SPEED.walk : SPEED.normal;
    this.speed = this.targetSpeed = this.range.start;
  }

  create() {
    this.makeTextures();
    this.gBg = this.add.graphics().setDepth(0);
    this.gTunnel = this.add.graphics().setDepth(1);
    this.gGate = this.add.graphics().setDepth(2);
    this.gateTexts = [0, 1, 2].map(() =>
      this.add
        .text(0, 0, '', {
          fontFamily: 'Rubik',
          fontStyle: '700',
          fontSize: '34px',
          color: '#ffffff',
          stroke: '#04121f',
          strokeThickness: 7,
          align: 'center',
          wordWrap: { width: 230, useAdvancedWrap: true },
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })
        .setOrigin(0.5)
        .setDepth(3)
        .setVisible(false),
    );
    this.gPlayer = this.add.graphics().setDepth(4);
    this.sparks = this.add
      .particles(0, 0, 'bb-spark', {
        speed: { min: 140, max: 420 },
        lifespan: { min: 380, max: 750 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 500,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(5);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xff3344, 0).setOrigin(0).setDepth(6);
    this.banner = this.add
      .text(0, 0, '', {
        fontFamily: 'Bungee',
        fontSize: '56px',
        color: '#ffd23f',
        stroke: '#000',
        strokeThickness: 10,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setAlpha(0);

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.seedStars();

    // Input: arrows / A-D / 1-2-3, swipes, taps on a screen third, or the HUD buttons.
    const kb = this.input.keyboard;
    kb?.on('keydown', (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) this.moveLane(this.lane - 1);
      else if (['ArrowRight', 'd', 'D'].includes(e.key)) this.moveLane(this.lane + 1);
      else if (['1', '2', '3'].includes(e.key)) this.moveLane(Number(e.key) - 2);
    });
    let downX = 0;
    let downT = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      downX = p.x;
      downT = p.downTime;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - downX;
      if (Math.abs(dx) > 28 && p.upTime - downT < 600) this.moveLane(this.lane + Math.sign(dx));
      else {
        const third = this.scale.width / 3;
        this.moveLane(p.x < third ? -1 : p.x > third * 2 ? 1 : 0);
      }
    });

    this.unsub.push(
      this.bridge.on('move-lane', ({ lane }) => this.moveLane(lane)),
      this.bridge.on('resume', () => {
        if (this.scene.isPaused()) this.scene.resume();
      }),
    );
    this.events.once('shutdown', () => this.unsub.forEach((u) => u()));
    this.events.once('destroy', () => this.unsub.forEach((u) => u()));

    this.nextSpawnAt = this.time.now + 900;
    this.showBanner(this.practice ? 'PRACTICE' : 'GO!', 900);
    this.bridge.emit('ready');
  }

  // ------------------------------------------------------------- setup

  private makeTextures() {
    if (this.textures.exists('bb-spark')) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture('bb-spark', 16, 16);
    g.destroy();
  }

  private layout() {
    const { width: w, height: h } = this.scale;
    this.f = Math.min(w * 0.72, h * 0.86);
    this.cx = w / 2;
    this.cy = h * 0.4;
    this.flash.setSize(w, h);
    this.banner.setPosition(w / 2, h * 0.33).setFontSize(Math.max(34, Math.min(64, w * 0.07)));
  }

  private seedStars() {
    this.stars = Array.from({ length: 160 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 900 + 10, s: Math.random() }));
  }

  // ------------------------------------------------------------- input

  private moveLane(target: number) {
    const lane = Phaser.Math.Clamp(target, -1, 1);
    if (lane === this.lane || this.ended) return;
    this.lane = lane;
    this.bridge.emit('runner:lane', { lane });
    sfx.lane();
    this.tweens.killTweensOf(this.player);
    const from = this.player.x;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 150,
      ease: 'Quad.Out',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        this.player.x = from + (lane - from) * t;
        this.player.hop = Math.sin(t * Math.PI) * 0.16;
      },
    });
  }

  // ------------------------------------------------------------- loop

  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;

    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 2.5);
    this.dist += this.speed * dt;
    this.phase += dt * (6 + this.speed * 1.6);
    this.camX += (this.player.x * 0.42 - this.camX) * Math.min(1, dt * 6);

    if (this.paletteT < 1) {
      this.paletteT = Math.min(1, this.paletteT + dt / 1.2);
      this.palette = lerpRGB(this.paletteFrom, this.paletteTo, this.paletteT);
    }

    // Gate lifecycle
    if (this.gate && this.gate.z - this.dist <= PLAYER_Z) this.resolveGate(time);
    if (!this.gate && !this.ended && time >= this.nextSpawnAt) {
      if (this.index < this.items.length) this.spawnGate(time);
      else this.finish();
    }

    this.drawStars(dt);
    this.drawTunnel();
    this.drawGate();
    this.drawPlayer(time);

    if (time - this.lastStatsAt > 150) {
      this.lastStatsAt = time;
      this.emitStats();
    }
  }

  private spawnGate(time: number) {
    const item = this.items[this.index];
    this.gate = { item, z: this.dist + GATE_SPAWN_Z, spawnedAt: time };
    item.options.forEach((o, i) => this.gateTexts[i].setText(o.text).setVisible(true));
    this.bridge.emit('runner:question', { index: this.index, total: this.items.length, item });
    sfx.whoosh();
  }

  private resolveGate(time: number) {
    const gate = this.gate!;
    this.gate = null;
    this.gateTexts.forEach((t) => t.setVisible(false));
    this.index++;
    this.answered++;

    const laneIdx = Math.round(this.player.x) + 1;
    const option = gate.item.options[laneIdx];
    const rtMs = Math.round(time - gate.spawnedAt);
    const [sx, sy] = this.project(laneIdx - 1, 0.8, PLAYER_Z + 0.3);

    this.recent.push(option.correct);
    if (this.recent.length > 8) this.recent.shift();
    const acc = this.recent.filter(Boolean).length / this.recent.length;

    this.bridge.emit('runner:answer', { item: gate.item, option, rtMs, speed: Number(this.speed.toFixed(2)) });

    if (option.correct) {
      this.correct++;
      this.streak++;
      sfx.correct();
      this.burst(sx, sy, [0x44d07b, 0xffd23f, 0xffffff]);
      // Speed up on a streak while accuracy is at or above ~80%.
      this.targetSpeed = Math.min(this.range.max, this.targetSpeed * (acc >= 0.8 && this.streak >= 2 ? 1.12 : 1.03));
      const level = Math.floor(this.correct / 4);
      if (level !== this.level) {
        this.level = level;
        this.paletteFrom = this.palette;
        this.paletteTo = PALETTES[level % PALETTES.length];
        this.paletteT = 0;
        if (!this.practice) this.showBanner(`LEVEL ${level + 1}`, 1000);
      }
      this.nextSpawnAt = time + 700;
    } else {
      this.streak = 0;
      sfx.wrong();
      this.burst(sx, sy, [0xff5964, 0xff8c42]);
      this.targetSpeed = Math.max(this.range.min, this.targetSpeed * 0.82);
      this.speed = Math.max(this.range.min, this.speed * 0.6);
      this.hurtUntil = time + 600;
      this.flash.setFillStyle(0xff3344, 0.28);
      this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 450 });
      if (!this.reduced) this.cameras.main.shake(220, 0.008);
      this.nextSpawnAt = time + 700;

      // Explain why, before moving on (conceptual change needs the wrong model to visibly fail).
      const correct = gate.item.options.find((o) => o.correct)!;
      this.time.delayedCall(380, () => {
        this.bridge.emit('feedback', {
          tone: 'wrong',
          title: 'Not that gate',
          chosen: option.text,
          correct: correct.text,
          misconception: option.misconception,
          explanation: gate.item.explanation,
          source: gate.item.source,
        });
        this.scene.pause();
      });
    }
    this.emitStats();
  }

  private finish() {
    this.ended = true;
    sfx.fanfare();
    this.showBanner(this.practice ? 'NICE!' : 'TUNNEL CLEAR', 1400);
    this.targetSpeed = this.range.min * 0.6;
    this.time.delayedCall(1500, () => this.bridge.emit('end', { reason: 'complete' }));
  }

  private emitStats() {
    this.bridge.emit('runner:stats', {
      streak: this.streak,
      distance: Math.floor(this.dist * 10),
      correct: this.correct,
      answered: this.answered,
      speed: this.speed,
      level: this.level + 1,
    });
  }

  // ------------------------------------------------------------- drawing

  private project(x: number, y: number, z: number): [number, number] {
    return [this.cx + ((x - this.camX) * this.f) / z, this.cy - ((y - CAM_Y) * this.f) / z];
  }

  private drawStars(dt: number) {
    const g = this.gBg;
    g.clear();
    const { width: w, height: h } = this.scale;
    const maxR = Math.hypot(w, h) * 0.6;
    const warp = this.reduced ? 0.02 : 0.06 + this.speed * 0.012;
    for (const st of this.stars) {
      st.r += st.r * warp * dt * (0.5 + st.s);
      if (st.r > maxR) {
        st.r = 8 + Math.random() * 40;
        st.a = Math.random() * Math.PI * 2;
      }
      const x = this.cx + Math.cos(st.a) * st.r;
      const y = this.cy + Math.sin(st.a) * st.r;
      const size = 0.6 + (st.r / maxR) * 2.2 * st.s;
      g.fillStyle(0xffffff, 0.25 + st.s * 0.7);
      g.fillRect(x, y, size, size);
    }
  }

  private quad(g: Phaser.GameObjects.Graphics, pts: [number, number][]) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }

  private drawTunnel() {
    const g = this.gTunnel;
    g.clear();
    const kNear = Math.floor(this.dist / TILE_D);
    const kFar = Math.floor((this.dist + FAR) / TILE_D);
    const ins = 0.05;
    const laneTile = Math.round(this.player.x) + 1;

    for (let k = kFar; k >= kNear; k--) {
      const z0raw = k * TILE_D - this.dist;
      const z1 = z0raw + TILE_D - ins;
      if (z1 <= NEAR) continue;
      const z0 = Math.max(NEAR, z0raw + ins);
      const fog = Math.min(1, Math.pow(Math.max(0, z0raw) / FAR, 0.8));

      for (let face = 0; face < 4; face++) {
        const { shade, holes } = FACES[face];
        for (let t = 0; t < 3; t++) {
          if (holes && hash(k, face * 3 + t) < 0.13) continue;
          const u0 = -HALF_W + t + ins;
          const u1 = -HALF_W + t + 1 - ins;
          const v = 0.86 + hash(k + 17, face * 5 + t) * 0.14;
          let col: RGB = [this.palette[0] * shade * v, this.palette[1] * shade * v, this.palette[2] * shade * v];
          if (face === 0 && t === laneTile && z0raw < 10) col = lerpRGB(col, [255, 255, 255], 0.1 * (1 - z0raw / 10));
          col = lerpRGB(col, BG, fog);
          g.fillStyle(toInt(col), 1);

          let pts: [number, number][];
          if (face === 0) pts = [this.project(u0, 0, z0), this.project(u1, 0, z0), this.project(u1, 0, z1), this.project(u0, 0, z1)];
          else if (face === 3) pts = [this.project(u0, TUNNEL_H, z0), this.project(u1, TUNNEL_H, z0), this.project(u1, TUNNEL_H, z1), this.project(u0, TUNNEL_H, z1)];
          else {
            const x = face === 1 ? -HALF_W : HALF_W;
            const y0 = t + ins;
            const y1 = t + 1 - ins;
            pts = [this.project(x, y0, z0), this.project(x, y1, z0), this.project(x, y1, z1), this.project(x, y0, z1)];
          }
          this.quad(g, pts);
        }
      }
    }
  }

  private drawGate() {
    const g = this.gGate;
    g.clear();
    if (!this.gate) return;
    const z = this.gate.z - this.dist;
    if (z <= NEAR) return;
    const fog = Math.min(1, Math.pow(z / FAR, 0.8));
    const alpha = 1 - fog;
    const panelW = 0.86;

    for (let i = 0; i < 3; i++) {
      const x0 = -HALF_W + i + 0.07;
      const x1 = x0 + panelW;
      const [ax, ay] = this.project(x0, 1.55, z);
      const [bx, by] = this.project(x1, 0.08, z);
      const w = bx - ax;
      const h = by - ay;
      g.fillStyle(0x0a2a44, 0.55 * alpha);
      g.fillRoundedRect(ax, ay, w, h, Math.min(10, w * 0.06));
      g.lineStyle(Math.max(1.5, (0.035 * this.f) / z), 0x7fd3ff, alpha);
      g.strokeRoundedRect(ax, ay, w, h, Math.min(10, w * 0.06));
      // energy bar on top
      g.fillStyle(0x7fd3ff, 0.9 * alpha);
      g.fillRect(ax + w * 0.2, ay - h * 0.035, w * 0.6, Math.max(2, h * 0.025));
      // lane number
      const [nx, ny] = this.project(x0 + panelW / 2, 1.42, z);
      g.fillStyle(0x7fd3ff, alpha);
      g.fillCircle(nx, ny, Math.max(2, (0.07 * this.f) / z));

      const txt = this.gateTexts[i];
      const [tx, ty] = this.project(x0 + panelW / 2, 0.78, z);
      const scale = (w * 0.86) / 230;
      txt.setPosition(tx, ty).setScale(scale).setAlpha(Math.min(1, alpha * 1.4));
    }
  }

  private drawPlayer(time: number) {
    const g = this.gPlayer;
    g.clear();
    const s = this.f / PLAYER_Z; // px per world unit at the player
    const [px, py] = this.project(this.player.x, 0, PLAYER_Z);
    const lift = this.player.hop * s;
    const P = (x: number, y: number): [number, number] => [px + x * s, py - y * s - lift];
    const hurt = time < this.hurtUntil && Math.floor(time / 80) % 2 === 0;
    const skin = hurt ? 0xff8088 : 0xb9bdca;
    const head = hurt ? 0xff9aa1 : 0xc8ccd8;
    const line = 0x262935;
    const run = this.ended ? 0.25 : 1;
    const sw = Math.sin(this.phase) * run;

    // shadow
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(px, py, 0.46 * s, 0.1 * s);

    const limb = (a: [number, number], b: [number, number], w: number) => {
      g.lineStyle(w * s + 0.05 * s, line, 1);
      g.lineBetween(a[0], a[1], b[0], b[1]);
      g.lineStyle(w * s, skin, 1);
      g.lineBetween(a[0], a[1], b[0], b[1]);
    };

    // legs (seen from behind: alternate lifting)
    limb(P(-0.06, 0.3), P(-0.09, 0.02 + Math.max(0, sw) * 0.12), 0.075);
    limb(P(0.06, 0.3), P(0.09, 0.02 + Math.max(0, -sw) * 0.12), 0.075);
    // arms swing opposite to legs
    limb(P(-0.11, 0.52), P(-0.23, 0.36 - sw * 0.08), 0.06);
    limb(P(0.11, 0.52), P(0.23, 0.36 + sw * 0.08), 0.06);

    // body
    const [bx, by] = P(-0.13, 0.6);
    g.fillStyle(line, 1).fillRoundedRect(bx - 0.02 * s, by - 0.02 * s, 0.3 * s, 0.36 * s, 0.12 * s);
    g.fillStyle(skin, 1).fillRoundedRect(bx, by, 0.26 * s, 0.32 * s, 0.11 * s);

    // antennae
    const bob = Math.abs(sw) * 0.02;
    for (const side of [-1, 1]) {
      const base = P(side * 0.08, 0.84);
      const tip = P(side * 0.17, 1.0 + bob);
      g.lineStyle(0.03 * s, line, 1).lineBetween(base[0], base[1], tip[0], tip[1]);
      g.fillStyle(line, 1).fillCircle(tip[0], tip[1], 0.042 * s);
      g.fillStyle(0xffd23f, 1).fillCircle(tip[0], tip[1], 0.03 * s);
    }
    // head
    const [hx, hy] = P(0, 0.72 + bob);
    g.fillStyle(line, 1).fillEllipse(hx, hy, 0.44 * s, 0.38 * s);
    g.fillStyle(head, 1).fillEllipse(hx, hy, 0.4 * s, 0.34 * s);
    g.fillStyle(0xffffff, 0.45).fillEllipse(hx - 0.07 * s, hy - 0.07 * s, 0.14 * s, 0.07 * s);
  }

  private burst(x: number, y: number, colors: number[]) {
    this.sparks.setParticleTint(colors[Math.floor(Math.random() * colors.length)]);
    this.sparks.explode(this.reduced ? 10 : 28, x, y);
  }

  private showBanner(text: string, ms: number) {
    this.banner.setText(text).setAlpha(1).setScale(this.reduced ? 1 : 0.6);
    this.tweens.killTweensOf(this.banner);
    if (!this.reduced) this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: ms, duration: 300 });
  }
}
