/**
 * `npm run validate-deck` runs this file. It checks every deck in
 * src/content/decks against the schema and prints readable errors.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DeckSchema, formatDeckErrors } from './schema';
import { runnerFit } from '../engine/scheduler';

const dir = join(__dirname, 'decks');
const files: string[] = readdirSync(dir).filter((f: string) => f.endsWith('.json'));

describe.each(files)('deck %s', (file) => {
  const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const parsed = DeckSchema.safeParse(data);

  it('matches the deck schema', () => {
    const errors = parsed.success ? [] : formatDeckErrors(parsed.error);
    expect(errors, `\n${errors.join('\n')}\n`).toEqual([]);
  });

  it('has exactly 10 pretest questions, all multiple choice', () => {
    if (!parsed.success) return;
    const pre = parsed.data.questions.filter((q) => q.pretest);
    expect(pre.length).toBe(10);
    expect(pre.every((q) => q.type === 'mcq')).toBe(true);
  });

  it('gives Lane Runner enough questions that fit on the gates', () => {
    if (!parsed.success) return;
    const fits = parsed.data.questions.filter((q) => q.type === 'mcq' && runnerFit(q));
    expect(fits.length).toBeGreaterThanOrEqual(6);
  });
});
