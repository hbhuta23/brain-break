/**
 * App state, saved to localStorage. No accounts: progress lives in the browser.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isoToDay, today as todayFn } from '../engine/clock';
import { kindOf, type AnswerEvent, type AppEvent, type LogEvent, type SessionEvent } from '../engine/events';
import { placeFromPretest, review, type CardState, type GameId } from '../engine/leitner';
import type { ConceptMiss } from '../engine/scheduler';
import type { Question } from '../content/schema';

export interface Settings {
  /** 1 = default; scales all UI and in-game text. */
  textScale: 1 | 1.15 | 1.3;
  reducedMotion: boolean;
  sound: boolean;
  /** Lane Runner's no-pressure mode. */
  walkMode: boolean;
}

export interface DeckProgress {
  cards: Record<string, CardState>;
  conceptMiss: Record<string, ConceptMiss>;
  pretest?: { day: number; correct: number; total: number; missed: string[] };
}

export interface AppState {
  onboarded: boolean;
  deckId: string | null;
  /** ISO yyyy-mm-dd of the learner's next quiz/exam, if they gave one. */
  examDate: string | null;
  /** Demo setting: days to pretend have passed. */
  dayOffset: number;
  settings: Settings;
  progress: Record<string, DeckProgress>;
  events: LogEvent[];
  seenTutorials: string[];
  /** Day number the learner finished onboarding. The first week runs in a fixed order. */
  startDay: number | null;
  /** Demo setting: open free play before the first week is over. */
  freePlayUnlocked: boolean;

  // derived helpers
  today: () => number;
  examDay: () => number | null;
  deckProgress: () => DeckProgress;

  // actions
  completeOnboarding: (deckId: string, examDate: string | null) => void;
  setExamDate: (iso: string | null) => void;
  setDeck: (deckId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  recordAnswer: (a: {
    q: Question;
    game: GameId;
    sessionId: string;
    correct: boolean;
    response: string;
    rtMs?: number;
    hintsUsed?: number;
    confidence?: number;
    speed?: number;
    misconception?: string;
  }) => void;
  recordPretest: (sessionId: string, results: { q: Question; correct: boolean; response: string; rtMs: number; misconception?: string }[]) => void;
  logSession: (e: Omit<SessionEvent, 'ts' | 'day' | 'deckId'>) => void;
  logApp: (type: AppEvent['type'], detail?: AppEvent['detail']) => void;
  markTutorial: (id: string) => void;
  setFreePlayUnlocked: (on: boolean) => void;
  skipDay: () => void;
  resetDemoClock: () => void;
  resetAll: () => void;
}

const emptyProgress = (): DeckProgress => ({ cards: {}, conceptMiss: {} });

const defaultSettings = (): Settings => ({
  textScale: 1,
  reducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  sound: true,
  walkMode: false,
});

const initial = () => ({
  onboarded: false,
  deckId: null as string | null,
  examDate: null as string | null,
  dayOffset: 0,
  settings: defaultSettings(),
  progress: {} as Record<string, DeckProgress>,
  events: [] as LogEvent[],
  seenTutorials: [] as string[],
  startDay: null as number | null,
  freePlayUnlocked: false,
});

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const base = () => ({ ts: Date.now(), day: get().today(), deckId: get().deckId ?? 'none' });
      const withProgress = (fn: (p: DeckProgress) => DeckProgress) => {
        const id = get().deckId;
        if (!id) return;
        set((s) => ({ progress: { ...s.progress, [id]: fn(s.progress[id] ?? emptyProgress()) } }));
      };

      return {
        ...initial(),

        today: () => todayFn(get().dayOffset),
        examDay: () => (get().examDate ? isoToDay(get().examDate!) : null),
        deckProgress: () => get().progress[get().deckId ?? ''] ?? emptyProgress(),

        completeOnboarding: (deckId, examDate) => {
          set({ onboarded: true, deckId, examDate, startDay: get().today() });
          get().logApp('onboarding-complete', { deckId, examDate });
        },
        setExamDate: (examDate) => set({ examDate }),
        setDeck: (deckId) => set({ deckId }),
        updateSettings: (patch) => {
          set((s) => ({ settings: { ...s.settings, ...patch } }));
          for (const [k, v] of Object.entries(patch)) get().logApp('setting-change', { [k]: v as number | boolean });
        },

        recordAnswer: ({ q, game, sessionId, correct, response, rtMs, hintsUsed = 0, confidence, speed, misconception }) => {
          const today = get().today();
          const nowTs = Date.now();
          const event: AnswerEvent = {
            ...base(),
            type: 'answer',
            sessionId,
            game,
            cardId: q.id,
            concept: q.concept,
            kind: kindOf(q),
            bloom: q.bloom,
            correct,
            response,
            rtMs,
            hintsUsed,
            confidence,
            speed,
            misconception,
          };
          set((s) => ({ events: [...s.events, event] }));
          if (game === 'practice') return;

          withProgress((p) => {
            const conceptMiss = { ...p.conceptMiss };
            const miss = conceptMiss[q.concept];
            if (!correct) conceptMiss[q.concept] = { game, day: today, ts: nowTs };
            // Answering it right somewhere else closes the loop.
            else if (miss && miss.game !== game) delete conceptMiss[q.concept];
            return {
              ...p,
              conceptMiss,
              cards: { ...p.cards, [q.id]: review(p.cards[q.id], { correct, today, nowTs, game, examDay: get().examDay() }) },
            };
          });
        },

        recordPretest: (sessionId, results) => {
          const today = get().today();
          const events: AnswerEvent[] = results.map((r) => ({
            ...base(),
            type: 'answer',
            sessionId,
            game: 'pretest',
            cardId: r.q.id,
            concept: r.q.concept,
            kind: kindOf(r.q),
            bloom: r.q.bloom,
            correct: r.correct,
            response: r.response,
            rtMs: r.rtMs,
            hintsUsed: 0,
            misconception: r.misconception,
          }));
          set((s) => ({ events: [...s.events, ...events] }));
          withProgress((p) => {
            const cards = { ...p.cards };
            for (const r of results) cards[r.q.id] = placeFromPretest(r.correct, today);
            return {
              ...p,
              cards,
              pretest: {
                day: today,
                correct: results.filter((r) => r.correct).length,
                total: results.length,
                missed: results.filter((r) => !r.correct).map((r) => r.q.id),
              },
            };
          });
          get().logApp('pretest-complete', { correct: results.filter((r) => r.correct).length, total: results.length });
        },

        logSession: (e) => set((s) => ({ events: [...s.events, { ...base(), ...e } as SessionEvent] })),
        logApp: (type, detail) => set((s) => ({ events: [...s.events, { ...base(), sessionId: 'app', type, detail }] })),
        setFreePlayUnlocked: (freePlayUnlocked) => set({ freePlayUnlocked }),
        markTutorial: (id) => set((s) => ({ seenTutorials: s.seenTutorials.includes(id) ? s.seenTutorials : [...s.seenTutorials, id] })),

        skipDay: () => {
          set((s) => ({ dayOffset: s.dayOffset + 1 }));
          get().logApp('day-skip', { dayOffset: get().dayOffset });
        },
        resetDemoClock: () => set({ dayOffset: 0 }),
        resetAll: () => set({ ...initial() }),
      };
    },
    {
      name: 'brain-break',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboarded: s.onboarded,
        deckId: s.deckId,
        examDate: s.examDate,
        dayOffset: s.dayOffset,
        settings: s.settings,
        progress: s.progress,
        events: s.events,
        seenTutorials: s.seenTutorials,
        startDay: s.startDay,
        freePlayUnlocked: s.freePlayUnlocked,
      }),
    },
  ),
);

/** Answer events for the current deck. */
export function useDeckAnswers(): AnswerEvent[] {
  const events = useApp((s) => s.events);
  const deckId = useApp((s) => s.deckId);
  return events.filter((e): e is AnswerEvent => e.type === 'answer' && e.deckId === deckId);
}
