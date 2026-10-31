/**
 * Deck registry. Any *.json file dropped in this folder is picked up
 * automatically and validated against the deck schema at load time.
 */
import { parseDeck, type Deck } from '../schema';

export interface DeckLoadResult {
  file: string;
  deck?: Deck;
  errors?: string[];
}

const raw = import.meta.glob<{ default: unknown }>('./*.json', { eager: true });

export const deckResults: DeckLoadResult[] = Object.entries(raw)
  .map(([path, mod]): DeckLoadResult => {
    const file = path.replace('./', '');
    return { file, ...parseDeck(mod.default) };
  })
  // Real decks first, the placeholder sample last.
  .sort((a, b) => Number(!!a.deck?.placeholder) - Number(!!b.deck?.placeholder));

export const decks: Deck[] = deckResults.flatMap((r) => (r.deck ? [r.deck] : []));

export function getDeck(id: string | null | undefined): Deck | undefined {
  return decks.find((d) => d.id === id);
}
