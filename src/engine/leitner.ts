/**
 * Leitner box schedule.
 *
 * Five boxes. A correct answer moves a card up one box and pushes it further
 * into the future. A miss drops it back to box 1, where it is due again in the
 * next session. The current session never repeats it (see scheduler.ts), so
 * a missed card always comes back *later*, usually in a different game.
 */

export type GameId = 'lane-runner' | 'fruit-slice' | 'escape-room' | 'pretest' | 'practice';

export const BOX_COUNT = 5;
/** Days until a card in each box is due again. Index 0 = box 1. */
export const BOX_INTERVALS = [0, 1, 2, 4, 7] as const;

export interface CardState {
  box: number;
  /** Day number the card is next due. */
  due: number;
  seen: number;
  correct: number;
  lastDay: number;
  /** Timestamp of the last attempt, used to keep a card out of the session it was just missed in. */
  lastTs: number;
  lastGame: GameId;
}

export interface ReviewInput {
  correct: boolean;
  today: number;
  nowTs: number;
  game: GameId;
  /** Day number of the learner's quiz/exam. Reviews are pulled in so they land before it. */
  examDay?: number | null;
}

export function intervalFor(box: number): number {
  return BOX_INTERVALS[Math.min(Math.max(box, 1), BOX_COUNT) - 1];
}

export function review(prev: CardState | undefined, input: ReviewInput): CardState {
  const { correct, today, nowTs, game, examDay } = input;
  const prevBox = prev?.box ?? 1;
  const box = correct ? Math.min(prevBox + 1, BOX_COUNT) : 1;

  let due = today + intervalFor(box);
  // Never schedule a review after the exam. Squeeze it in the day before (or tomorrow at the latest).
  if (correct && examDay != null && examDay > today && due >= examDay) {
    due = Math.max(today + 1, examDay - 1);
  }

  return {
    box,
    due,
    seen: (prev?.seen ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
    lastDay: today,
    lastTs: nowTs,
    lastGame: game,
  };
}

/**
 * Pretest placement: misses go to box 1 (due right away), correct answers
 * start in box 2 (due tomorrow), so the first sessions focus on gaps.
 */
export function placeFromPretest(correct: boolean, today: number): CardState {
  return {
    box: correct ? 2 : 1,
    due: correct ? today + intervalFor(2) : today,
    seen: 1,
    correct: correct ? 1 : 0,
    lastDay: today,
    // Pretest misses should be eligible in the very first game, so don't mark them as "just seen".
    lastTs: 0,
    lastGame: 'pretest',
  };
}

export function isDue(state: CardState | undefined, today: number): boolean {
  return !!state && state.due <= today;
}
