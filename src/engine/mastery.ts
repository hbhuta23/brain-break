/**
 * Criterion-referenced mastery (Glaser; Bloom's mastery learning).
 *
 * A concept is MASTERED once the learner has answered it correctly
 *   - at least 3 separate times,
 *   - on at least 2 different days,
 *   - in at least 2 kinds of question,
 *   - including at least one at the Apply level or above.
 *
 * Nobody is ranked against anyone else. Pretest and practice-round answers
 * don't count: mastery has to be shown during play.
 */
import { APPLY_OR_ABOVE } from '../content/schema';
import type { AnswerEvent } from './events';

export type MasteryState = 'new' | 'practicing' | 'mastered';

export const MASTERY_RULE = { correct: 3, days: 2, kinds: 2 } as const;

export interface ConceptMastery {
  state: MasteryState;
  attempts: number;
  correct: number;
  days: number;
  kinds: number;
  hasApply: boolean;
  /** 0–1, how far along the four criteria the learner is. Used for the map rings. */
  progress: number;
  /** Most recent answer was wrong. The map shows a "shaky" marker. */
  shaky: boolean;
}

const COUNTS_FOR_MASTERY = new Set(['lane-runner', 'fruit-slice', 'escape-room']);

export function conceptMastery(answers: AnswerEvent[]): ConceptMastery {
  const play = answers.filter((a) => COUNTS_FOR_MASTERY.has(a.game));
  const right = play.filter((a) => a.correct);

  const correct = right.length;
  const days = new Set(right.map((a) => a.day)).size;
  const kinds = new Set(right.map((a) => a.kind)).size;
  const hasApply = right.some((a) => APPLY_OR_ABOVE.has(a.bloom));

  const mastered = correct >= MASTERY_RULE.correct && days >= MASTERY_RULE.days && kinds >= MASTERY_RULE.kinds && hasApply;

  const progress =
    (Math.min(correct, MASTERY_RULE.correct) / MASTERY_RULE.correct +
      Math.min(days, MASTERY_RULE.days) / MASTERY_RULE.days +
      Math.min(kinds, MASTERY_RULE.kinds) / MASTERY_RULE.kinds +
      (hasApply ? 1 : 0)) /
    4;

  const last = play.reduce<AnswerEvent | undefined>((acc, a) => (!acc || a.ts > acc.ts ? a : acc), undefined);

  return {
    state: mastered ? 'mastered' : play.length ? 'practicing' : 'new',
    attempts: play.length,
    correct,
    days,
    kinds,
    hasApply,
    progress,
    shaky: !!last && !last.correct && !mastered,
  };
}

/** Mastery for every concept in a deck, from the full answer log. */
export function masteryByConcept(conceptIds: string[], answers: AnswerEvent[]): Map<string, ConceptMastery> {
  const grouped = new Map<string, AnswerEvent[]>(conceptIds.map((c) => [c, []]));
  for (const a of answers) grouped.get(a.concept)?.push(a);
  return new Map(conceptIds.map((c) => [c, conceptMastery(grouped.get(c)!)]));
}
