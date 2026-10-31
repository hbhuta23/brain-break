/**
 * Deck registry. Any *.json file dropped in this folder is picked up
 * automatically and validated against the deck schema at load time.
 */
import { DeckSchema, formatDeckErrors, type Deck } from '../schema';

export interface DeckLoadResult {
  file: string;
  deck?: Deck;
  errors?: string[];
}

const raw = import.meta.glob<{ default: unknown }>('./*.json', { eager: true });

export const deckResults: DeckLoadResult[] = Object.entries(raw)
  .map(([path, mod]) => {
    const file = path.replace('./', '');
    const parsed = DeckSchema.safeParse(mod.default);
    return parsed.success ? { file, deck: parsed.data } : { file, errors: formatDeckErrors(parsed.error) };
  })
  // Real decks first, the placeholder sample last.
  .sort((a, b) => Number(!!a.deck?.placeholder) - Number(!!b.deck?.placeholder));

export const decks: Deck[] = deckResults.flatMap((r) => (r.deck ? [r.deck] : []));

export function getDeck(id: string | null | undefined): Deck | undefined {
  return decks.find((d) => d.id === id);
}
