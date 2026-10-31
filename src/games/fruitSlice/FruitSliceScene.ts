/**
 * Fruit Slice — telling similar concepts apart (Gagné: intellectual skills /
 * discrimination, Bloom: Understand).
 *
 * A homage to Fruit Ninja. A sign names one concept, fruit fly up carrying
 * examples, and you slice the ones that match and let the rest fall. Slicing
 * *is* the classification. Every lure is an example of a neighbouring concept,
 * so a wrong slice shows exactly which two ideas are being confused, and the
 * game stops to explain the difference instead of just flashing a red X.
 */
import Phaser from 'phaser';
import type { Bridge } from '../shared/bridge';
import type { SlicePlan, SliceTarget } from '../../engine/scheduler';
import { sfx } from '../shared/sfx';
import { FRUITS, JUICE, R as TEX_R, makeFruitTextures, type Fruit } from './fruitArt';

export interface FruitSliceData {
  bridge: Bridge;
  plan: SlicePlan;
}

const MAX_STRIKES = 3;
const TRAIL_MS = 110;

interface Flyer {
  item: SliceTarget;
  isTarget: boolean;
  fruit: Fruit;
  img: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Container;
  tagW: number;
  tagH: number;
  badge: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vr: number;
  r: number;
  bornAt: number;
  done: boolean;
}

interface Half {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  vr: number;
}

export class FruitSliceScene extends Phaser.Scene {
  private bridge!: Bridge;
  private plan!: SlicePlan;
  private reduced = false;
  private slow = 1;

  private bg!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private gTrail!: Phaser.GameObjects.Graphics;
  private gStrings!: Phaser.GameObjects.Graphics;
  private juice!: Phaser.GameObjects.Particles.ParticleEmitter;
  private banner!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Rectangle;

  private flyers: Flyer[] = [];
  private halves: Half[] = [];
  private splats: Phaser.GameObjects.Image[] = [];
  private trail: { x: number; y: number; t: number }[] = [];
  private pointerDown = false;

  private wave = -1;
  private queue: SliceTarget[] = [];
  private nextLaunchAt = 0;
  private strikes = 0;
  private score = 0;
  private strokeHits = 0;
  private missedTargets: SliceTarget[] = [];
  private waveActive = false;
  private finished = false;

  private gravity = 600;
  private rFruit = 48;
  private unsub: (() => void)[] = [];

  constructor() {
    super('fruit-slice');
  }

  init(data: FruitSliceData) {
    this.bridge = data.bridge;
    this.plan = data.plan;
    this.reduced = data.bridge.settings.reducedMotion;
    // Walk mode and reduced motion both slow the fruit for more reading time.
    this.slow = data.bridge.settings.walkMode || this.reduced ? 1.3 : 1;
  }

  create() {
    makeFruitTextures(this.textures);
    this.bg = this.add.image(0, 0, 'wood').setOrigin(0.5).setDepth(0);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(1.5);
    this.gStrings = this.add.graphics().setDepth(2);
    this.juice = this.add
      .particles(0, 0, 'droplet', {
        speed: { min: 120, max: 460 },
        lifespan: { min: 350, max: 800 },
        scale: { start: 0.7, end: 0.1 },
        alpha: { start: 1, end: 0.2 },
        gravityY: 900,
        emitting: false,
      })
      .setDepth(6);
    this.gTrail = this.add.graphics().setDepth(8);
    this.banner = this.add
      .text(0, 0, '', { fontFamily: 'Bungee', fontSize: '60px', color: '#ffd23f', stroke: '#000', strokeThickness: 11, align: 'center' })
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0);
    this.sub = this.add
      .text(0, 0, '', {
        fontFamily: 'Rubik',
        fontStyle: '900',
        fontSize: '26px',
        color: '#fff4d8',
        stroke: '#000',
        strokeThickness: 7,
        align: 'center',
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setDepth(10);

    this.layout();
    this.scale.on('resize', this.layout, this);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerDown = true;
      this.strokeHits = 0;
      this.trail = [{ x: p.x, y: p.y, t: this.time.now }];
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.pointerDown) return;
      const prev = this.trail[this.trail.length - 1];
      const cur = { x: p.x, y: p.y, t: this.time.now };
      this.trail.push(cur);
      if (prev && Phaser.Math.Distance.Between(prev.x, prev.y, cur.x, cur.y) > 4) this.sliceAlong(prev.x, prev.y, cur.x, cur.y);
    });
    const end = () => {
      this.pointerDown = false;
      this.endStroke();
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);

    // Keyboard: each fruit's tag carries a number; press it to slice.
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!n) return;
      const f = this.flyers.find((fl) => !fl.done && fl.badge === n);
      if (f) {
        this.strokeHits = 0;
        this.slice(f, Math.random() * Math.PI);
        this.endStroke();
      }
    });

    this.unsub.push(
      this.bridge.on('resume', () => {
        if (this.scene.isPaused()) this.scene.resume();
      }),
    );
    this.events.once('shutdown', () => this.unsub.forEach((u) => u()));
    this.events.once('destroy', () => this.unsub.forEach((u) => u()));

    this.bridge.emit('ready');
    this.time.delayedCall(300, () => this.startWave(0));
  }

  private layout() {
    const { width: w, height: h } = this.scale;
    const cover = Math.max(w / 1400, h / 1000);
    this.bg.setPosition(w / 2, h / 2).setScale(cover);
    this.vignette.setDisplaySize(w, h);
    this.flash.setSize(w, h);
    this.rFruit = Phaser.Math.Clamp(Math.min(w, h) * 0.075, 36, 60);
    this.banner.setPosition(w / 2, h * 0.4).setFontSize(Math.max(36, Math.min(68, w * 0.075)));
    this.sub.setPosition(w / 2, h * 0.4 + 64).setWordWrapWidth(Math.min(620, w - 40));
    // Time aloft ~4.6s (longer when slowed) so there's time to read the tag.
    const T = 4.6 * this.slow;
    this.gravity = (8 * (h * 0.66)) / (T * T);
  }

  // ------------------------------------------------------------- waves

  private startWave(i: number) {
    this.wave = i;
    const w = this.plan.waves[i];
    this.queue = [...w.items];
    this.strikes = 0;
    this.missedTargets = [];
    this.waveActive = true;
    this.emitStats();
    this.bridge.emit('slice:wave', { index: i, total: this.plan.waves.length, wave: w });
    this.showBanner(`WAVE ${i + 1}`, `Slice: ${w.targetName}`, 1500);
    this.nextLaunchAt = this.time.now + 1900;
  }

  private waveTarget() {
    return this.plan.waves[this.wave].target;
  }

  private endWave(outOfStrikes: boolean) {
    this.waveActive = false;
    const w = this.plan.waves[this.wave];
    const next = () => {
      if (this.wave + 1 < this.plan.waves.length) this.startWave(this.wave + 1);
      else this.finish();
    };
    if (outOfStrikes) this.showBanner('OUT OF STRIKES', 'Next wave resets them.', 1300);

    if (this.missedTargets.length) {
      const missed = this.missedTargets;
      this.time.delayedCall(outOfStrikes ? 1400 : 500, () => {
        this.bridge.emit('feedback', {
          tone: 'missed',
          title: `These were ${w.targetName}, and they fell`,
          explanation: `${w.targetName}: ${w.targetDefinition}`,
          items: missed.map((m) => ({ text: m.text, note: m.explanation })),
        });
        this.scene.pause();
        this.time.delayedCall(250, next);
      });
    } else this.time.delayedCall(outOfStrikes ? 1500 : 600, next);
  }

  private finish() {
    this.finished = true;
    sfx.fanfare();
    this.showBanner('DOJO CLEAR', `Score ${this.score}`, 1500);
    this.time.delayedCall(1700, () => this.bridge.emit('end', { reason: 'complete' }));
  }

  // ------------------------------------------------------------- flyers

  private launch() {
    const item = this.queue.shift()!;
    const { width: w, height: h } = this.scale;
    const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const r = this.rFruit * (fruit === 'watermelon' ? 1.15 : 1);
    const used = new Set(this.flyers.filter((f) => !f.done).map((f) => f.badge));
    let badge = 1;
    while (used.has(badge)) badge++;

    const tagW = Math.min(250, w * 0.46);
    const text = this.add.text(0, 0, item.text, {
      fontFamily: 'Rubik',
      fontStyle: '700',
      fontSize: `${Math.round(17 * this.bridge.settings.textScale)}px`,
      color: '#221509',
      align: 'center',
      wordWrap: { width: tagW - 34, useAdvancedWrap: true },
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    text.setOrigin(0.5).setX(8);
    const tagH = text.height + 18;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-tagW / 2 + 3, -tagH / 2 + 5, tagW, tagH, 12);
    g.fillStyle(0xfff4d8, 1).fillRoundedRect(-tagW / 2, -tagH / 2, tagW, tagH, 12);
    g.lineStyle(3, 0x1a0f05, 1).strokeRoundedRect(-tagW / 2, -tagH / 2, tagW, tagH, 12);
    g.fillStyle(0x1a0f05, 1).fillCircle(-tagW / 2 + 16, 0, 12);
    const num = this.add
      .text(-tagW / 2 + 16, 1, String(badge), { fontFamily: 'Bungee', fontSize: '14px', color: '#ffd23f' })
      .setOrigin(0.5);
    const tag = this.add.container(0, 0, [g, text, num]).setDepth(4);

    const x = Phaser.Math.Between(Math.round(w * 0.22), Math.round(w * 0.78));
    const y = h + r + tagH + 10;
    const rise = h * Phaser.Math.FloatBetween(0.6, 0.72) + tagH;
    const vy = -Math.sqrt(2 * this.gravity * rise);
    const airtime = (2 * -vy) / this.gravity;
    const vx = ((w / 2 - x) * Phaser.Math.FloatBetween(0.3, 0.8)) / airtime;

    const img = this.add.image(x, y, `fruit-${fruit}`).setScale(r / TEX_R).setDepth(3);
    const fl: Flyer = {
      item,
      isTarget: item.concept === this.waveTarget(),
      fruit,
      img,
      tag,
      tagW,
      tagH,
      badge,
      x,
      y,
      vx,
      vy,
      vr: Phaser.Math.FloatBetween(-1.6, 1.6),
      r,
      bornAt: this.time.now,
      done: false,
    };
    this.flyers.push(fl);
    sfx.launch();
  }

  /** Does the segment hit the fruit or its tag? */
  private hits(f: Flyer, x1: number, y1: number, x2: number, y2: number) {
    const line = new Phaser.Geom.Line(x1, y1, x2, y2);
    if (Phaser.Geom.Intersects.LineToCircle(line, new Phaser.Geom.Circle(f.x, f.y, f.r * 0.95))) return true;
    const rect = new Phaser.Geom.Rectangle(f.tag.x - f.tagW / 2, f.tag.y - f.tagH / 2, f.tagW, f.tagH);
    return Phaser.Geom.Intersects.LineToRectangle(line, rect);
  }

  private sliceAlong(x1: number, y1: number, x2: number, y2: number) {
    for (const f of this.flyers) {
      if (!f.done && this.hits(f, x1, y1, x2, y2)) this.slice(f, Math.atan2(y2 - y1, x2 - x1));
    }
  }

  private slice(f: Flyer, angle: number) {
    f.done = true;
    const rtMs = Math.round(this.time.now - f.bornAt);
    const correct = f.isTarget;
    this.bridge.emit('slice:result', { item: f.item, target: this.waveTarget(), sliced: true, correct, rtMs });

    // Split into halves that fly apart perpendicular to the cut.
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const push = 140;
    (['a', 'b'] as const).forEach((side, i) => {
      const dir = i === 0 ? -1 : 1;
      const img = this.add
        .image(f.x, f.y, `half-${f.fruit}-${side}`)
        .setScale(f.r / TEX_R)
        .setRotation(angle)
        .setDepth(5);
      this.halves.push({ img, vx: f.vx * 0.6 + nx * push * dir, vy: Math.min(f.vy, 0) * 0.3 + ny * push * dir - 120, vr: dir * Phaser.Math.FloatBetween(2, 4) });
    });
    f.img.destroy();

    if (correct) {
      this.score += 1;
      this.strokeHits++;
      sfx.slice();
      sfx.splat();
      this.splat(f.x, f.y, JUICE[f.fruit], f.r);
      this.juice.setParticleTint(JUICE[f.fruit]);
      this.juice.explode(this.reduced ? 8 : 22, f.x, f.y);
      this.floatText(f.x, f.y - f.r, '+1', '#ffd23f');
      this.tweens.add({ targets: f.tag, alpha: 0, scale: 0.8, duration: 220, onComplete: () => f.tag.destroy() });
      this.emitStats();
      return;
    }

    // Sliced a lure: like hitting a bomb, but the "explosion" is an explanation.
    sfx.slice();
    sfx.strike();
    this.strikes++;
    this.emitStats();
    this.splat(f.x, f.y, 0x6b6b6b, f.r);
    this.flash.setFillStyle(0xff3344, 0.3);
    this.tweens.add({ targets: this.flash, fillAlpha: 0, duration: 420 });
    if (!this.reduced) this.cameras.main.shake(200, 0.01);
    this.floatText(f.x, f.y - f.r, 'X', '#ff5964', 54);
    const wave = this.plan.waves[this.wave];
    this.time.delayedCall(420, () => {
      f.tag.destroy();
      this.bridge.emit('feedback', {
        tone: 'wrong',
        title: `That's not ${wave.targetName}`,
        chosen: f.item.text,
        correct: `This is an example of ${f.item.conceptName}.`,
        misconception: f.item.explanation,
        explanation: `${wave.targetName}: ${wave.targetDefinition}`,
        source: f.item.source,
      });
      this.scene.pause();
    });
  }

  private endStroke() {
    if (this.strokeHits >= 2) {
      const bonus = this.strokeHits;
      this.score += bonus;
      sfx.combo(this.strokeHits);
      const { width: w, height: h } = this.scale;
      this.floatText(w / 2, h * 0.25, `${this.strokeHits} FRUIT COMBO +${bonus}`, '#ffd23f', 36);
      this.emitStats();
    }
    this.strokeHits = 0;
  }

  private fellOff(f: Flyer) {
    f.done = true;
    f.img.destroy();
    f.tag.destroy();
    const correct = !f.isTarget;
    this.bridge.emit('slice:result', { item: f.item, target: this.waveTarget(), sliced: false, correct, rtMs: Math.round(this.time.now - f.bornAt) });
    if (correct) return;
    this.strikes++;
    this.missedTargets.push(f.item);
    sfx.strike();
    this.floatText(Phaser.Math.Clamp(f.x, 40, this.scale.width - 40), this.scale.height - 60, 'X', '#ff5964', 54);
    this.emitStats();
  }

  // ------------------------------------------------------------- loop

  update(time: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    const { height: h } = this.scale;
    if (this.finished) {
      this.drawTrail(time);
    }

    if (this.waveActive && this.queue.length && time >= this.nextLaunchAt && this.strikes < MAX_STRIKES) {
      this.launch();
      this.nextLaunchAt = time + (1900 + Math.random() * 500) * this.slow;
    }

    this.gStrings.clear();
    for (const f of this.flyers) {
      if (f.done) continue;
      f.vy += this.gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.img.setPosition(f.x, f.y).setRotation(f.img.rotation + f.vr * dt);
      const ty = f.y + f.r + 14 + f.tagH / 2;
      f.tag.setPosition(f.x, ty);
      this.gStrings.lineStyle(2, 0x1a0f05, 0.8).lineBetween(f.x, f.y + f.r * 0.6, f.x, ty - f.tagH / 2);
      if (f.vy > 0 && f.y - f.r > h + 10) this.fellOff(f);
    }
    this.flyers = this.flyers.filter((f) => !f.done);

    for (const half of this.halves) {
      half.vy += this.gravity * 1.4 * dt;
      half.img.x += half.vx * dt;
      half.img.y += half.vy * dt;
      half.img.rotation += half.vr * dt;
    }
    this.halves = this.halves.filter((half) => {
      if (half.img.y > h + 200) {
        half.img.destroy();
        return false;
      }
      return true;
    });

    if (this.waveActive && this.strikes >= MAX_STRIKES) {
      // Clear the board and move on.
      this.queue = [];
      for (const f of this.flyers) {
        f.done = true;
        this.tweens.add({ targets: [f.img, f.tag], alpha: 0, duration: 250, onComplete: () => (f.img.destroy(), f.tag.destroy()) });
      }
      this.flyers = [];
      this.endWave(true);
    } else if (this.waveActive && !this.queue.length && !this.flyers.length) this.endWave(false);

    this.drawTrail(time);
  }

  private drawTrail(now: number) {
    const g = this.gTrail;
    g.clear();
    this.trail = this.trail.filter((p) => now - p.t < TRAIL_MS);
    const n = this.trail.length;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const k = i / (n - 1);
      const w = 2 + k * 11;
      g.lineStyle(w + 8, 0x9fdcff, 0.18 * k).lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(w, 0xffffff, 0.95 * k).lineBetween(a.x, a.y, b.x, b.y);
      g.fillStyle(0xffffff, 0.95 * k).fillCircle(b.x, b.y, w / 2);
    }
  }

  // ------------------------------------------------------------- effects

  private splat(x: number, y: number, tint: number, r: number) {
    const s = this.add
      .image(x, y, `splat-${Math.floor(Math.random() * 3)}`)
      .setTint(tint)
      .setAlpha(0.7)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale((r / 64) * Phaser.Math.FloatBetween(0.9, 1.2))
      .setDepth(1);
    this.splats.push(s);
    this.tweens.add({ targets: s, alpha: 0, delay: 2600, duration: 1800, onComplete: () => s.destroy() });
    if (this.splats.length > 14) this.splats.shift()?.destroy();
  }

  private floatText(x: number, y: number, text: string, color: string, size = 30) {
    const t = this.add
      .text(x, y, text, { fontFamily: 'Bungee', fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 7 })
      .setOrigin(0.5)
      .setDepth(9);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  private showBanner(title: string, sub: string, ms: number) {
    for (const [obj, text] of [
      [this.banner, title],
      [this.sub, sub],
    ] as const) {
      this.tweens.killTweensOf(obj);
      obj.setText(text).setAlpha(1).setScale(this.reduced ? 1 : 0.7);
      if (!this.reduced) this.tweens.add({ targets: obj, scale: 1, duration: 260, ease: 'Back.Out' });
      this.tweens.add({ targets: obj, alpha: 0, delay: ms, duration: 300 });
    }
  }

  private emitStats() {
    this.bridge.emit('slice:stats', { score: this.score, strikes: this.strikes, combo: this.strokeHits });
  }
}
