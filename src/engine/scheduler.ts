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
 *
 * Which game a question can appear in comes from the deck's `games` field.
 */
import type { DeckIndex } from '../content/deckIndex';
import type { Mcq, Question, SliceItem, SortSet } from '../content/schema';
import { kindOf, type QuestionKind } from './events';
import type { CardState, GameId } from './leitner';

export const RECENT_MS = 10 * 60_000;
/** Longest answer that fits on a Lane Runner gate (gate text wraps and shrinks to fit). */
export const GATE_MAX_CHARS = 80;
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

function rank<T extends Question>(qs: T[], game: GameId, ctx: ScheduleContext) {
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

/** Can this question be played on three gates? Returns the answer and two distractors that fit. */
export function runnerFit(q: Mcq): RunnerFit | null {
  if (q.stem.length > RUNNER_STEM_MAX || q.answer.length > GATE_MAX_CHARS) return null;
  const short = q.distractors.filter((d) => d.text.length <= GATE_MAX_CHARS);
  if (short.length < 2) return null;
  return { answer: q.answer, distractors: short.slice(0, 2) };
}

export interface RunnerOption {
  text: string;
  correct: boolean;
  /** Short name of the mistaken idea behind a wrong option. */
  label?: string;
  /** Why the option is wrong. */
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
  return index.deck.questions.filter((q): q is Mcq => q.type === 'mcq' && q.games.includes('lane-runner') && runnerFit(q) !== null);
}

export function pickRunnerItems(ctx: ScheduleContext, n: number): RunnerItem[] {
  const rng = ctx.rng ?? Math.random;
  const chosen = rank(runnerEligible(ctx.index), 'lane-runner', ctx)
    .slice(0, n)
    .map((r) => r.q);
  return shuffle(chosen, rng).map((q) => {
    const fit = runnerFit(q)!;
    const options: RunnerOption[] = shuffle(
      [
        { text: fit.answer, correct: true },
        ...fit.distractors.map((d) => ({ text: d.text, correct: false, label: d.label, misconception: d.misconception })),
      ],
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
  /** Should this one be sliced? */
  match: boolean;
  /** Why it does or doesn't match the prompt. */
  why: string;
  bloom: Question['bloom'];
  source: Question['source'];
}

export interface SliceWave {
  setId: string;
  prompt: string;
  conceptName: string;
  explanation: string;
  items: SliceTarget[];
}

export interface SlicePlan {
  waves: SliceWave[];
}

const TIER_WEIGHT: Record<Tier, number> = { 0: 4, 1: 3, 2: 2, 3: 0.5, 4: 0 };

/** Pick the most urgent sort sets, one per wave. */
export function pickSlicePlan(ctx: ScheduleContext, waveCount = 3): SlicePlan | null {
  const rng = ctx.rng ?? Math.random;
  const { index } = ctx;
  const sets = index.deck.sortSets.filter((s) => {
    const first = index.question.get(s.itemIds[0]);
    return first?.games.includes('fruit-slice');
  });
  if (!sets.length) return null;

  const itemsOf = (s: SortSet) => s.itemIds.map((id) => index.question.get(id) as SliceItem);
  const urgency = (s: SortSet) => {
    const items = itemsOf(s);
    return items.reduce((sum, it) => sum + TIER_WEIGHT[tierOf(it, 'fruit-slice', ctx)], 0) / items.length;
  };
  const order = new Map(sets.map((s, i) => [s.id, i]));
  const chosen = [...sets].sort((a, b) => urgency(b) - urgency(a) || order.get(a.id)! - order.get(b.id)!).slice(0, waveCount);

  return {
    waves: chosen.map((s) => ({
      setId: s.id,
      prompt: s.prompt,
      conceptName: index.concept.get(s.concept)?.name ?? s.concept,
      explanation: s.explanation,
      items: shuffle(itemsOf(s), rng).map((q) => ({
        cardId: q.id,
        concept: q.concept,
        conceptName: index.concept.get(q.concept)?.name ?? q.concept,
        text: q.text,
        match: q.match,
        why: q.explanation,
        bloom: q.bloom,
        source: q.source,
      })),
    })),
  };
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
  const slice = ctx.index.deck.questions.filter((q) => q.type === 'slice' && q.games.includes('fruit-slice'));
  const count = (qs: Question[], game: GameId, tiers: Tier[]) => qs.filter((q) => tiers.includes(tierOf(q, game, ctx))).length;
  return {
    dueRunner: count(runner, 'lane-runner', [0, 1]),
    dueSlice: count(slice, 'fruit-slice', [0, 1]),
    newRunner: count(runner, 'lane-runner', [2]),
    newSlice: count(slice, 'fruit-slice', [2]),
    crossGame: count([...runner, ...slice], 'practice', [0]),
  };
}
