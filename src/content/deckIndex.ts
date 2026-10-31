/** Fast lookups over a validated deck. Built once per deck and cached. */
import type { Concept, Deck, Question, SortSet, Topic } from './schema';

export interface DeckIndex {
  deck: Deck;
  question: Map<string, Question>;
  concept: Map<string, Concept>;
  topic: Map<string, Topic>;
  sortSet: Map<string, SortSet>;
  byConcept: Map<string, Question[]>;
}

const cache = new WeakMap<Deck, DeckIndex>();

export function indexDeck(deck: Deck): DeckIndex {
  const hit = cache.get(deck);
  if (hit) return hit;
  const byConcept = new Map<string, Question[]>();
  for (const q of deck.questions) {
    const list = byConcept.get(q.concept) ?? [];
    list.push(q);
    byConcept.set(q.concept, list);
  }
  const idx: DeckIndex = {
    deck,
    question: new Map(deck.questions.map((q) => [q.id, q])),
    concept: new Map(deck.concepts.map((c) => [c.id, c])),
    topic: new Map(deck.topics.map((t) => [t.id, t])),
    sortSet: new Map(deck.sortSets.map((s) => [s.id, s])),
    byConcept,
  };
  cache.set(deck, idx);
  return idx;
}
