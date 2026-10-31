/**
 * Deck format. A deck file is validated against `RawDeckSchema` (the
 * authoring format, see docs/DECK_FORMAT.md) and then normalized into the
 * `Deck` shape the engine and games use: passages are resolved into each
 * question's source, sort sets are expanded into one card per fruit, and
 * concept ids get display names.
 */
import { z } from 'zod';

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type Bloom = (typeof BLOOM_LEVELS)[number];

/** Bloom levels that count as "applying" a concept for the mastery rule. */
export const APPLY_OR_ABOVE: ReadonlySet<Bloom> = new Set(['apply', 'analyze', 'evaluate', 'create']);

export const GAME_SLOTS = ['lane-runner', 'code-lock', 'scenario-lock', 'fruit-slice', 'ordering-lock', 'final-door'] as const;
export type GameSlot = (typeof GAME_SLOTS)[number];

// ------------------------------------------------------------------ raw (authoring) format

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids use lowercase letters, digits and dashes (e.g. "mem-03")');

const text = (field: string) => z.string().trim().min(1, `${field} can't be empty`);

const bloom = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(z.enum(BLOOM_LEVELS, { message: `bloom must be one of ${BLOOM_LEVELS.join(', ')}` }));

const RawPassage = z.object({
  id,
  source: z.string().optional(),
  lesson: text('passage lesson'),
  section: text('passage section'),
  text: text('passage text'),
});

/** A concept is listed under its topic, either as a bare id or with display details. */
const RawConcept = z.union([
  id,
  z.object({
    id,
    name: text('concept name'),
    short: z.string().max(28, 'concept short name max 28 characters').optional(),
    definition: z.string().optional(),
  }),
]);

const RawTopic = z.object({ id, title: text('topic title'), concepts: z.array(RawConcept).min(1) });

const RawDistractor = z.object({
  text: text('distractor text'),
  /** Short label for the mistaken idea, e.g. "Forgetting is linear". Logged for analysis. */
  misconception: text('distractor misconception'),
  /** What the learner sees when they pick it: why it's wrong. */
  feedback: text('distractor feedback'),
});

const RawBase = z.object({
  id,
  concept: id,
  topic: id.optional(),
  bloom,
  games: z.array(z.enum(GAME_SLOTS)).min(1, 'list at least one game this question is for'),
  pretest: z.boolean().optional().default(false),
  passage: id,
  prompt: text('prompt'),
  explanation: text('explanation'),
});

const RawChoice = RawBase.extend({
  type: z.enum(['recall', 'scenario']),
  answer: text('answer'),
  distractors: z.array(RawDistractor).min(2, 'needs at least 2 distractors'),
});

const RawSort = RawBase.extend({
  type: z.literal('sort'),
  items: z
    .array(
      z.object({
        text: text('sort item text').max(90, 'sort item text must fit on a fruit tag (max 90 characters)'),
        match: z.boolean(),
        why: text('sort item why'),
      }),
    )
    .min(3, 'a sort set needs at least 3 items'),
});

const RawOrder = RawBase.extend({
  type: z.literal('order'),
  steps: z.array(text('step')).min(3, 'order questions need at least 3 steps'),
});

const RawExplain = RawBase.extend({
  type: z.literal('explain'),
  modelAnswer: text('modelAnswer'),
  keyIdeas: z.array(text('key idea')).min(1),
});

const RawQuestion = z.discriminatedUnion('type', [RawChoice, RawSort, RawOrder, RawExplain]);

const SoloLevel = z.object({ level: text('SOLO level'), score: z.number(), description: text('SOLO description') });

export const RawDeckSchema = z
  .object({
    id,
    title: text('deck title'),
    version: z.union([z.string(), z.number()]).transform(String),
    description: z.string().optional(),
    author: z.string().optional(),
    source: z.string().optional(),
    /** True for development samples. The app shows a banner when set. */
    placeholder: z.boolean().optional(),
    soloRubric: z.array(SoloLevel).optional().default([]),
    topics: z.array(RawTopic).min(1),
    passages: z.array(RawPassage),
    questions: z.array(RawQuestion).min(1),
  })
  .passthrough()
  .superRefine((deck, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
    const unique = (ids: string[], label: string, path: string) => {
      const seen = new Set<string>();
      ids.forEach((v, i) => {
        if (seen.has(v)) issue(`duplicate ${label} id "${v}"`, [path, i, 'id']);
        seen.add(v);
      });
    };
    const conceptIds = deck.topics.flatMap((t) => t.concepts.map((c) => (typeof c === 'string' ? c : c.id)));
    unique(deck.topics.map((t) => t.id), 'topic', 'topics');
    unique(conceptIds, 'concept', 'topics');
    unique(deck.passages.map((p) => p.id), 'passage', 'passages');
    unique(deck.questions.map((q) => q.id), 'question', 'questions');

    const concepts = new Set(conceptIds);
    const passages = new Set(deck.passages.map((p) => p.id));
    deck.questions.forEach((q, i) => {
      if (!concepts.has(q.concept)) issue(`question "${q.id}" points at a concept "${q.concept}" that no topic lists`, ['questions', i, 'concept']);
      if (!passages.has(q.passage)) issue(`question "${q.id}" points at unknown passage "${q.passage}"`, ['questions', i, 'passage']);
      if (q.type === 'recall' || q.type === 'scenario') {
        const texts = [q.answer, ...q.distractors.map((d) => d.text)].map((t) => t.trim().toLowerCase());
        if (new Set(texts).size !== texts.length) issue(`question "${q.id}" has a distractor identical to the answer or another distractor`, ['questions', i]);
      }
      if (q.type === 'sort') {
        const hits = q.items.filter((it) => it.match).length;
        if (hits < 1 || hits === q.items.length) issue(`sort "${q.id}" needs both items to slice and items to let fall`, ['questions', i, 'items']);
      }
    });
  });

export type RawDeck = z.infer<typeof RawDeckSchema>;

// ------------------------------------------------------------------ normalized (engine) format

export interface Source {
  passage: string;
  ref: string;
}

export interface Distractor {
  text: string;
  /** Short label for the mistaken idea. */
  label: string;
  /** Why it's wrong, shown to the learner. */
  misconception: string;
}

interface Base {
  id: string;
  concept: string;
  bloom: Bloom;
  games: GameSlot[];
  pretest: boolean;
  source: Source;
  explanation: string;
}

export interface Mcq extends Base {
  type: 'mcq';
  format: 'fact' | 'scenario';
  stem: string;
  answer: string;
  distractors: Distractor[];
}

/** One fruit in Fruit Slice. Whether it should be sliced depends on its set's prompt. */
export interface SliceItem extends Base {
  type: 'slice';
  set: string;
  text: string;
  match: boolean;
}

export interface OrderQ extends Base {
  type: 'order';
  prompt: string;
  steps: string[];
}

export interface ExplainQ extends Base {
  type: 'explain';
  prompt: string;
  modelAnswer: string;
  keyIdeas: string[];
}

export type Question = Mcq | SliceItem | OrderQ | ExplainQ;
export type QuestionType = Question['type'];

export interface Topic {
  id: string;
  title: string;
}

export interface Concept {
  id: string;
  topic: string;
  name: string;
  short: string;
  definition?: string;
}

/** A Fruit Slice round: one prompt and the items that fly with it. */
export interface SortSet {
  id: string;
  concept: string;
  prompt: string;
  explanation: string;
  bloom: Bloom;
  source: Source;
  itemIds: string[];
}

export interface Deck {
  id: string;
  title: string;
  version: string;
  description?: string;
  author?: string;
  placeholder?: boolean;
  soloRubric: { level: string; score: number; description: string }[];
  topics: Topic[];
  concepts: Concept[];
  sortSets: SortSet[];
  questions: Question[];
}

const ACRONYMS: Record<string, string> = { zpd: 'ZPD', ui: 'UI', ux: 'UX' };

/** "zpd-scaffolding" -> "ZPD scaffolding". Authors can override with a { id, name } concept entry. */
export function nameFromId(conceptId: string): string {
  const words = conceptId.split('-').map((w) => ACRONYMS[w] ?? w);
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function normalizeDeck(raw: RawDeck): Deck {
  const passages = new Map(raw.passages.map((p) => [p.id, p]));
  const sourceOf = (pid: string): Source => {
    const p = passages.get(pid)!;
    return { passage: p.text, ref: `${p.lesson} › ${p.section}` };
  };

  const concepts: Concept[] = raw.topics.flatMap((t) =>
    t.concepts.map((c) => {
      if (typeof c === 'string') {
        const name = nameFromId(c);
        return { id: c, topic: t.id, name, short: name.length <= 28 ? name : name.slice(0, 27) + '…' };
      }
      return { id: c.id, topic: t.id, name: c.name, short: c.short ?? (c.name.length <= 28 ? c.name : c.name.slice(0, 27) + '…'), definition: c.definition };
    }),
  );

  const sortSets: SortSet[] = [];
  const questions: Question[] = raw.questions.flatMap((q): Question[] => {
    const base = {
      id: q.id,
      concept: q.concept,
      bloom: q.bloom,
      games: q.games,
      pretest: q.pretest,
      source: sourceOf(q.passage),
      explanation: q.explanation,
    };
    switch (q.type) {
      case 'recall':
      case 'scenario':
        return [
          {
            ...base,
            type: 'mcq',
            format: q.type === 'scenario' ? 'scenario' : 'fact',
            stem: q.prompt,
            answer: q.answer,
            distractors: q.distractors.map((d) => ({ text: d.text, label: d.misconception, misconception: d.feedback })),
          },
        ];
      case 'sort': {
        const items: SliceItem[] = q.items.map((it, i) => ({
          ...base,
          id: `${q.id}--${i + 1}`,
          pretest: false,
          type: 'slice',
          set: q.id,
          text: it.text,
          match: it.match,
          explanation: it.why,
        }));
        sortSets.push({ id: q.id, concept: q.concept, prompt: q.prompt, explanation: q.explanation, bloom: q.bloom, source: base.source, itemIds: items.map((i) => i.id) });
        return items;
      }
      case 'order':
        return [{ ...base, type: 'order', prompt: q.prompt, steps: q.steps }];
      case 'explain':
        return [{ ...base, type: 'explain', prompt: q.prompt, modelAnswer: q.modelAnswer, keyIdeas: q.keyIdeas }];
    }
  });

  return {
    id: raw.id,
    title: raw.title,
    version: raw.version,
    description: raw.description ?? raw.source,
    author: raw.author,
    placeholder: raw.placeholder,
    soloRubric: raw.soloRubric,
    topics: raw.topics.map((t) => ({ id: t.id, title: t.title })),
    concepts,
    sortSets,
    questions,
  };
}

/** Validate and normalize in one step. */
export function parseDeck(data: unknown): { deck: Deck } | { errors: string[] } {
  const parsed = RawDeckSchema.safeParse(data);
  if (!parsed.success) return { errors: formatDeckErrors(parsed.error) };
  return { deck: normalizeDeck(parsed.data) };
}

/** Readable list of problems, one per line, with the JSON path that caused each. */
export function formatDeckErrors(error: z.ZodError): string[] {
  return error.issues.map((iss) => `${iss.path.length ? iss.path.join('.') : '(deck)'}: ${iss.message}`);
}
