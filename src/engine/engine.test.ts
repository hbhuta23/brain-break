import { describe, expect, it } from 'vitest';
import sample from '../content/decks/sample.json';
import { DeckSchema } from '../content/schema';
import { indexDeck } from '../content/deckIndex';
import { dayNumber, isoToDay, dayToIso, relativeDay } from './clock';
import { review, placeFromPretest, BOX_INTERVALS, type CardState } from './leitner';
import { conceptMastery } from './mastery';
import type { AnswerEvent } from './events';
import { eventsToCsv } from './events';
import { pickRunnerItems, pickSlicePlan, tierOf, runnerFit, RECENT_MS, type ScheduleContext } from './scheduler';

const deck = DeckSchema.parse(sample);
const index = indexDeck(deck);
const T = 20_000; // arbitrary day number
const NOW = 1_800_000_000_000;

function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('clock', () => {
  it('round-trips ISO dates', () => {
    const d = isoToDay('2026-11-09');
    expect(dayToIso(d)).toBe('2026-11-09');
    expect(isoToDay('2026-11-10') - d).toBe(1);
  });
  it('counts local days', () => {
    expect(dayNumber(new Date(2026, 10, 2, 23, 59)) - dayNumber(new Date(2026, 10, 2, 0, 1))).toBe(0);
  });
  it('describes relative days', () => {
    expect(relativeDay(T + 1, T)).toBe('tomorrow');
    expect(relativeDay(T + 4, T)).toBe('in 4 days');
  });
});

describe('leitner', () => {
  const base = { today: T, nowTs: NOW, game: 'lane-runner' as const };

  it('moves a new card up one box when correct', () => {
    const s = review(undefined, { ...base, correct: true });
    expect(s.box).toBe(2);
    expect(s.due).toBe(T + BOX_INTERVALS[1]);
  });

  it('drops a card back to box 1 on a miss, due again today', () => {
    const s = review({ box: 4, due: T, seen: 3, correct: 3, lastDay: T - 4, lastTs: 0, lastGame: 'fruit-slice' }, { ...base, correct: false });
    expect(s.box).toBe(1);
    expect(s.due).toBe(T);
    expect(s.lastGame).toBe('lane-runner');
  });

  it('caps at box 5', () => {
    let s: CardState | undefined;
    for (let i = 0; i < 8; i++) s = review(s, { ...base, correct: true });
    expect(s!.box).toBe(5);
  });

  it('pulls reviews in so they land before the exam', () => {
    const prev: CardState = { box: 4, due: T, seen: 4, correct: 4, lastDay: T - 1, lastTs: 0, lastGame: 'lane-runner' };
    const s = review(prev, { ...base, correct: true, examDay: T + 3 });
    expect(s.due).toBe(T + 2); // box 5 would be +7, squeezed to the day before the exam
  });

  it('places pretest misses in box 1 and hits in box 2', () => {
    expect(placeFromPretest(false, T)).toMatchObject({ box: 1, due: T });
    expect(placeFromPretest(true, T)).toMatchObject({ box: 2, due: T + 1 });
  });
});

function ans(p: Partial<AnswerEvent>): AnswerEvent {
  return {
    type: 'answer', ts: NOW, day: T, deckId: 'sample', sessionId: 's', game: 'lane-runner',
    cardId: 'x', concept: 'c', kind: 'recall', bloom: 'remember', correct: true, response: '', hintsUsed: 0, ...p,
  };
}

describe('mastery', () => {
  it('is new with no attempts', () => {
    expect(conceptMastery([]).state).toBe('new');
  });

  it('ignores pretest answers', () => {
    expect(conceptMastery([ans({ game: 'pretest' })]).state).toBe('new');
  });

  it('needs 3 correct, 2 days, 2 kinds and one apply-level answer', () => {
    const almost = [
      ans({ day: T, kind: 'recall' }),
      ans({ day: T + 1, kind: 'slice' }),
      ans({ day: T + 1, kind: 'recall' }),
    ];
    expect(conceptMastery(almost).state).toBe('practicing'); // no apply-level answer yet
    expect(conceptMastery([...almost.slice(0, 2), ans({ day: T + 1, kind: 'scenario', bloom: 'apply' })]).state).toBe('mastered');
  });

  it('is not mastered when everything happens on one day', () => {
    const oneDay = [ans({ kind: 'recall' }), ans({ kind: 'slice' }), ans({ kind: 'scenario', bloom: 'apply' })];
    expect(conceptMastery(oneDay).state).toBe('practicing');
  });

  it('flags shaky when the latest answer was wrong', () => {
    const m = conceptMastery([ans({ ts: 1 }), ans({ ts: 2, correct: false })]);
    expect(m.shaky).toBe(true);
  });
});

describe('scheduler', () => {
  const ctx = (over: Partial<ScheduleContext> = {}): ScheduleContext => ({
    index, cards: {}, conceptMiss: {}, today: T, nowTs: NOW, rng: seeded(), ...over,
  });

  it('only gives Lane Runner questions that fit on gates', () => {
    const items = pickRunnerItems(ctx(), 8);
    expect(items).toHaveLength(8);
    for (const it of items) {
      expect(it.options).toHaveLength(3);
      expect(it.options.filter((o) => o.correct)).toHaveLength(1);
      expect(it.options.every((o) => o.text.length <= 40)).toBe(true);
    }
  });

  it('puts due cards ahead of new ones', () => {
    const dueId = 'motiv-03';
    const items = pickRunnerItems(
      ctx({ cards: { [dueId]: { box: 2, due: T - 1, seen: 1, correct: 1, lastDay: T - 2, lastTs: 0, lastGame: 'lane-runner' } } }),
      1,
    );
    expect(items[0].cardId).toBe(dueId);
  });

  it('holds back a card missed minutes ago', () => {
    const q = index.question.get('reinf-01')!;
    const c = ctx({ cards: { 'reinf-01': { box: 1, due: T, seen: 1, correct: 0, lastDay: T, lastTs: NOW - 1000, lastGame: 'lane-runner' } } });
    expect(tierOf(q, 'lane-runner', c)).toBe(4);
    expect(tierOf(q, 'lane-runner', { ...c, nowTs: NOW + RECENT_MS })).toBe(1);
  });

  it('brings a concept missed in Lane Runner back first in Fruit Slice', () => {
    const plan = pickSlicePlan(ctx({ conceptMiss: { 'negative-reinforcement': { game: 'lane-runner', day: T, ts: NOW } } }))!;
    expect(plan.groupId).toBe('reinforcement');
    expect(plan.waves[0].target).toBe('negative-reinforcement');
  });

  it('builds slice waves with both targets and lures', () => {
    const plan = pickSlicePlan(ctx())!;
    expect(plan.waves).toHaveLength(3);
    for (const w of plan.waves) {
      const hits = w.items.filter((i) => i.concept === w.target).length;
      expect(hits).toBeGreaterThanOrEqual(2);
      expect(w.items.length - hits).toBeGreaterThanOrEqual(1);
    }
  });

  it('rejects mcqs whose answers are too long for gates', () => {
    const q = index.question.get('testing-01');
    if (q?.type !== 'mcq') throw new Error('fixture');
    expect(runnerFit({ ...q, answer: 'x'.repeat(41) })).toBeNull();
  });
});

describe('event export', () => {
  it('escapes commas and quotes in CSV', () => {
    const csv = eventsToCsv([ans({ response: 'Add, "then" remove' })]);
    expect(csv.split('\n')[1]).toContain('"Add, ""then"" remove"');
  });
});
