/**
 * `npm run validate-deck` runs this file. It checks every deck in
 * src/content/decks against the schema and prints readable errors.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPLY_OR_ABOVE, RawDeckSchema, formatDeckErrors, normalizeDeck } from './schema';
import { indexDeck } from './deckIndex';
import { runnerEligible } from '../engine/scheduler';

const dir = join(__dirname, 'decks');
const files: string[] = readdirSync(dir).filter((f: string) => f.endsWith('.json'));

describe.each(files)('deck %s', (file) => {
  const parsed = RawDeckSchema.safeParse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
  const deck = parsed.success ? normalizeDeck(parsed.data) : null;

  it('matches the deck format', () => {
    const errors = parsed.success ? [] : formatDeckErrors(parsed.error);
    expect(errors, `\n${errors.join('\n')}\n`).toEqual([]);
  });

  it('has exactly 10 pretest questions, all multiple choice', () => {
    if (!deck) return;
    const pre = deck.questions.filter((q) => q.pretest);
    expect(pre.length).toBe(10);
    expect(pre.every((q) => q.type === 'mcq')).toBe(true);
  });

  it('gives Lane Runner enough questions', () => {
    if (!deck) return;
    expect(runnerEligible(indexDeck(deck)).length).toBeGreaterThanOrEqual(6);
  });

  // A warning, not a failure: these concepts can never reach "mastered" until they get an apply-level question.
  it('reports concepts that can never be mastered (no apply-level question)', async ({ annotate }) => {
    if (!deck) return;
    const missing = deck.concepts.filter((c) => !deck.questions.some((q) => q.concept === c.id && APPLY_OR_ABOVE.has(q.bloom)));
    if (missing.length) await annotate(`No apply-level question for: ${missing.map((c) => c.id).join(', ')}`, 'warning');
  });
});
