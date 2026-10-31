/**
 * Decides which cards each game gets.
 *
 * Priority, highest first:
 *   0. Cards whose concept was missed in a *different* game. This is how a miss
 *      in Lane Runner resurfaces in Fruit Slice (and later the Escape Room).
 *   1. Cards that are due today (lowest box first).
 *   2. New cards the learner has never seen, in deck order.
 *   3. Everything else, soonest-due first, as extra practice.
 * Cards attempted in the last few minutes are held back, so a miss never
 * comes straight back in the same session.
 */
import type { DeckIndex } from '../content/deckIndex';
import type { Mcq, Question, SliceItem } from '../content/schema';
import { kindOf, type QuestionKind } from './events';
import type { CardState, GameId } from './leitner';

export const RECENT_MS = 10 * 60_000;
/** Longest answer that fits on a Lane Runner gate. */
export const GATE_MAX_CHARS = 40;
export const RUNNER_STEM_MAX = 170;

export interface ConceptMiss {
  game: GameId;
  day: number;
  ts: number;
}

export interface ScheduleContext {
  index: DeckIndex;
  cards: Record<string, CardState>;
  conceptMiss: Record<string, ConceptMiss>;
  today: number;
  nowTs: number;
  rng?: () => number;
}

type Tier = 0 | 1 | 2 | 3 | 4;

export function tierOf(q: Question, game: GameId, ctx: ScheduleContext): Tier {
  const st = ctx.cards[q.id];
  if (st && ctx.nowTs - st.lastTs < RECENT_MS) return 4;
  const miss = ctx.conceptMiss[q.concept];
  if (miss && miss.game !== game) return 0;
  if (st && st.due <= ctx.today) return 1;
  if (!st) return 2;
  return 3;
}

function rank(qs: Question[], game: GameId, ctx: ScheduleContext) {
  const order = new Map(ctx.index.deck.questions.map((q, i) => [q.id, i]));
  return qs
    .map((q) => ({ q, tier: tierOf(q, game, ctx), st: ctx.cards[q.id] }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (a.st?.box ?? 0) - (b.st?.box ?? 0) ||
        (a.st?.due ?? 0) - (b.st?.due ?? 0) ||
        order.get(a.q.id)! - order.get(b.q.id)!,
    );
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- Lane Runner

export interface RunnerFit {
  answer: string;
  distractors: Mcq['distractors'];
}

/** Can this question be played on three gates? Returns the answer and two short-enough distractors. */
export function runnerFit(q: Mcq): RunnerFit | null {
  if (q.stem.length > RUNNER_STEM_MAX || q.answer.length > GATE_MAX_CHARS) return null;
  const short = q.distractors.filter((d) => d.text.length <= GATE_MAX_CHARS);
  if (short.length < 2) return null;
  return { answer: q.answer, distractors: short.slice(0, 2) };
}

export interface RunnerOption {
  text: string;
  correct: boolean;
  misconception?: string;
}

export interface RunnerItem {
  cardId: string;
  concept: string;
  conceptName: string;
  kind: QuestionKind;
  bloom: Question['bloom'];
  stem: string;
  options: RunnerOption[];
  explanation: string;
  source: Question['source'];
}

export function runnerEligible(index: DeckIndex): Mcq[] {
  return index.deck.questions.filter((q): q is Mcq => q.type === 'mcq' && runnerFit(q) !== null);
}

export function pickRunnerItems(ctx: ScheduleContext, n: number): RunnerItem[] {
  const rng = ctx.rng ?? Math.random;
  const ranked = rank(runnerEligible(ctx.index), 'lane-runner', ctx);
  const chosen = ranked.slice(0, n).map((r) => r.q as Mcq);
  return shuffle(chosen, rng).map((q) => {
    const fit = runnerFit(q)!;
    const options: RunnerOption[] = shuffle(
      [{ text: fit.answer, correct: true }, ...fit.distractors.map((d) => ({ text: d.text, correct: false, misconception: d.misconception }))],
      rng,
    );
    return {
      cardId: q.id,
      concept: q.concept,
      conceptName: ctx.index.concept.get(q.concept)?.name ?? q.concept,
      kind: kindOf(q),
      bloom: q.bloom,
      stem: q.stem,
      options,
      explanation: q.explanation,
      source: q.source,
    };
  });
}

// ---------------------------------------------------------------- Fruit Slice

export interface SliceTarget {
  cardId: string;
  concept: string;
  conceptName: string;
  text: string;
  explanation: string;
  bloom: Question['bloom'];
  source: Question['source'];
}

export interface SliceWave {
  target: string;
  targetName: string;
  targetDefinition: string;
  items: SliceTarget[];
}

export interface SlicePlan {
  groupId: string;
  groupTitle: string;
  waves: SliceWave[];
}

const TIER_WEIGHT: Record<Tier, number> = { 0: 4, 1: 3, 2: 2, 3: 0.5, 4: 0 };

export function pickSlicePlan(ctx: ScheduleContext, waveCount = 3, perWave = 5): SlicePlan | null {
  const rng = ctx.rng ?? Math.random;
  const { index } = ctx;
  const items = index.deck.questions.filter((q): q is SliceItem => q.type === 'slice');
  if (!items.length || !index.deck.sliceGroups.length) return null;

  // The group with the most urgent work wins.
  const groupScore = (gid: string) =>
    items.filter((i) => i.group === gid).reduce((s, i) => s + TIER_WEIGHT[tierOf(i, 'fruit-slice', ctx)], 0);
  const group = [...index.deck.sliceGroups].sort((a, b) => groupScore(b.id) - groupScore(a.id))[0];
  const groupItems = items.filter((i) => i.group === group.id);

  // Targets: concepts with the most urgent items first, and no concept twice in a row.
  const conceptUrgency = (c: string) => Math.min(...groupItems.filter((i) => i.concept === c).map((i) => tierOf(i, 'fruit-slice', ctx)));
  const byUrgency = [...group.concepts].sort((a, b) => conceptUrgency(a) - conceptUrgency(b));
  const targets: string[] = [];
  for (let w = 0; w < waveCount; w++) targets.push(byUrgency[w % byUrgency.length]);

  const used = new Set<string>();
  const take = (pool: SliceItem[], k: number): SliceItem[] => {
    const ranked = rank(pool, 'fruit-slice', ctx).map((r) => r.q as SliceItem);
    const fresh = ranked.filter((q) => !used.has(q.id));
    const picked = [...fresh, ...ranked.filter((q) => used.has(q.id))].slice(0, k);
    picked.forEach((q) => used.add(q.id));
    return picked;
  };

  const toTarget = (q: SliceItem): SliceTarget => ({
    cardId: q.id,
    concept: q.concept,
    conceptName: index.concept.get(q.concept)?.name ?? q.concept,
    text: q.text,
    explanation: q.explanation,
    bloom: q.bloom,
    source: q.source,
  });

  const waves = targets.map((target) => {
    const nTargets = Math.max(2, Math.round(perWave * 0.45));
    const hits = take(groupItems.filter((i) => i.concept === target), nTargets);
    const lures = take(groupItems.filter((i) => i.concept !== target), perWave - hits.length);
    return {
      target,
      targetName: index.concept.get(target)?.name ?? target,
      targetDefinition: index.concept.get(target)?.definition ?? '',
      items: shuffle([...hits, ...lures], rng).map(toTarget),
    };
  });

  return { groupId: group.id, groupTitle: group.title, waves };
}

// ---------------------------------------------------------------- Summary

export interface QueueSummary {
  dueRunner: number;
  dueSlice: number;
  newRunner: number;
  newSlice: number;
  crossGame: number;
}

export function queueSummary(ctx: ScheduleContext): QueueSummary {
  const runner = runnerEligible(ctx.index);
  const slice = ctx.index.deck.questions.filter((q) => q.type === 'slice');
  const count = (qs: Question[], game: GameId, tiers: Tier[]) => qs.filter((q) => tiers.includes(tierOf(q, game, ctx))).length;
  return {
    dueRunner: count(runner, 'lane-runner', [0, 1]),
    dueSlice: count(slice, 'fruit-slice', [0, 1]),
    newRunner: count(runner, 'lane-runner', [2]),
    newSlice: count(slice, 'fruit-slice', [2]),
    crossGame: count([...runner, ...slice], 'practice', [0]),
  };
}
