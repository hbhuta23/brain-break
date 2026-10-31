/**
 * Everything the app records for evaluation. Learners are told about this
 * during onboarding and can export or delete it from Settings.
 */
import type { Bloom, Question } from '../content/schema';
import type { GameId } from './leitner';

/** Question "kind" for the mastery rule (needs 2+ different kinds). */
export type QuestionKind = 'recall' | 'scenario' | 'slice' | 'order' | 'explain';

export function kindOf(q: Question): QuestionKind {
  if (q.type === 'mcq') return q.format === 'scenario' ? 'scenario' : 'recall';
  return q.type;
}

interface EventBase {
  ts: number;
  /** App day number (includes the demo offset). */
  day: number;
  deckId: string;
  sessionId: string;
}

export interface AnswerEvent extends EventBase {
  type: 'answer';
  game: GameId;
  cardId: string;
  concept: string;
  kind: QuestionKind;
  bloom: Bloom;
  correct: boolean;
  /** What the learner chose: answer text, "sliced", "let-fall", etc. */
  response: string;
  /** Time from the question appearing to the answer, in ms. */
  rtMs?: number;
  hintsUsed: number;
  /** 1–4 confidence rating, if asked (Escape Room locks). */
  confidence?: number;
  /** Lane Runner speed when answered, for adaptive-difficulty analysis. */
  speed?: number;
  /** The misconception the learner showed, if they chose a written distractor. */
  misconception?: string;
}

export interface SessionEvent extends EventBase {
  type: 'session-start' | 'session-end';
  game: GameId;
  /** "session" = part of today's planned break; "free" = free play; "practice" = onboarding. */
  mode?: 'session' | 'free' | 'practice';
  /** For session-end: answers attempted and correct. */
  attempted?: number;
  correct?: number;
  durationMs?: number;
  /** For session-end: ended by finishing or by quitting early. */
  reason?: 'complete' | 'quit' | 'out-of-lives';
}

export interface AppEvent extends EventBase {
  type: 'onboarding-complete' | 'pretest-complete' | 'day-skip' | 'setting-change' | 'feedback-viewed' | 'hint';
  detail?: Record<string, string | number | boolean | null>;
}

export type LogEvent = AnswerEvent | SessionEvent | AppEvent;

export function newSessionId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const CSV_COLUMNS = [
  'ts', 'iso', 'day', 'deckId', 'sessionId', 'type', 'game', 'cardId', 'concept', 'kind', 'bloom',
  'correct', 'response', 'rtMs', 'hintsUsed', 'confidence', 'speed', 'misconception',
  'attempted', 'durationMs', 'reason', 'mode', 'detail',
] as const;

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function eventsToCsv(events: LogEvent[]): string {
  const rows = events.map((e) => {
    const rec = { ...e, iso: new Date(e.ts).toISOString() } as Record<string, unknown>;
    // session-end stores correct count under the same key as answer correctness; keep it in its own column.
    if (e.type === 'session-end') rec.correct = e.correct;
    return CSV_COLUMNS.map((c) => csvCell(rec[c])).join(',');
  });
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}
