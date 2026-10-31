import { useMemo } from 'react';
import { getDeck } from '../content/decks';
import { indexDeck, type DeckIndex } from '../content/deckIndex';
import { useApp } from '../store/useApp';
import type { LogEvent, SessionEvent } from '../engine/events';
import type { GameId } from '../engine/leitner';
import { masteryByConcept, type ConceptMastery } from '../engine/mastery';
import type { AnswerEvent } from '../engine/events';
import type { ScheduleContext } from '../engine/scheduler';

export function useDeckIndex(): DeckIndex | null {
  const deckId = useApp((s) => s.deckId);
  return useMemo(() => {
    const deck = getDeck(deckId);
    return deck ? indexDeck(deck) : null;
  }, [deckId]);
}

export function answersFor(events: LogEvent[], deckId: string | null): AnswerEvent[] {
  return events.filter((e): e is AnswerEvent => e.type === 'answer' && e.deckId === deckId);
}

export function useMastery(index: DeckIndex | null): Map<string, ConceptMastery> {
  const events = useApp((s) => s.events);
  const deckId = useApp((s) => s.deckId);
  return useMemo(
    () => (index ? masteryByConcept(index.deck.concepts.map((c) => c.id), answersFor(events, deckId)) : new Map()),
    [index, events, deckId],
  );
}

/** Snapshot of everything the scheduler needs, read straight from the store. */
export function scheduleContext(index: DeckIndex): ScheduleContext {
  const s = useApp.getState();
  const p = s.deckProgress();
  return { index, cards: p.cards, conceptMiss: p.conceptMiss, today: s.today(), nowTs: Date.now() };
}

export interface TodayPlan {
  runnerDone: boolean;
  sliceDone: boolean;
  allDone: boolean;
  next: 'lane-runner' | 'fruit-slice' | null;
}

export function todayPlan(events: LogEvent[], deckId: string | null, today: number): TodayPlan {
  const done = (game: GameId) =>
    events.some(
      (e): e is SessionEvent =>
        e.type === 'session-end' && e.deckId === deckId && e.day === today && e.game === game && e.mode === 'session' && e.reason === 'complete',
    );
  const runnerDone = done('lane-runner');
  const sliceDone = done('fruit-slice');
  return {
    runnerDone,
    sliceDone,
    allDone: runnerDone && sliceDone,
    next: !runnerDone ? 'lane-runner' : !sliceDone ? 'fruit-slice' : null,
  };
}

/** Distinct days with at least one completed game, for the "days you came back" stat. */
export function activeDays(events: LogEvent[], deckId: string | null): number {
  return new Set(events.filter((e) => e.type === 'session-end' && e.deckId === deckId && e.reason === 'complete').map((e) => e.day)).size;
}
