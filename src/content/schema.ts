/**
 * Deck format. Every game reads from the same deck, so this schema is the
 * contract between whoever writes questions and the rest of the app.
 * See docs/DECK_FORMAT.md for the authoring guide.
 */
import { z } from 'zod';

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export type Bloom = (typeof BLOOM_LEVELS)[number];

/** Bloom levels that count as "applying" a concept for the mastery rule. */
export const APPLY_OR_ABOVE: ReadonlySet<Bloom> = new Set(['apply', 'analyze', 'evaluate', 'create']);

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids use lowercase letters, digits and dashes (e.g. "cog-load-03")');

const nonEmpty = (field: string) => z.string().trim().min(1, `${field} can't be empty`);

/** Where in the learner's notes a question came from. Shown in hints and feedback. */
export const SourceSchema = z.object({
  passage: nonEmpty('source.passage'),
  ref: nonEmpty('source.ref').describe('e.g. "Module 1, Lesson 3: Cognitive Load"'),
});

const QuestionBase = z.object({
  id,
  concept: id,
  bloom: z.enum(BLOOM_LEVELS),
  source: SourceSchema,
  /** Shown after every answer. Should teach, not just restate the answer. */
  explanation: nonEmpty('explanation'),
  /** Mark exactly 10 questions across the deck for the diagnostic pretest. */
  pretest: z.boolean().optional(),
});

/** A wrong answer written from a real misconception. */
export const DistractorSchema = z.object({
  text: nonEmpty('distractor text'),
  /** Why someone would pick this, and why it is wrong. Shown when it's picked. */
  misconception: nonEmpty('distractor misconception'),
});

export const McqSchema = QuestionBase.extend({
  type: z.literal('mcq'),
  /** "fact" = straight recall. "scenario" = a short situation, asks which principle it shows. */
  format: z.enum(['fact', 'scenario']),
  stem: nonEmpty('stem'),
  answer: nonEmpty('answer'),
  distractors: z.array(DistractorSchema).min(2, 'mcq needs at least 2 distractors'),
});

/** One flying item in Fruit Slice. Its concept decides whether it should be sliced. */
export const SliceItemSchema = QuestionBase.extend({
  type: z.literal('slice'),
  group: id,
  text: nonEmpty('text').max(90, 'slice text must fit on a fruit tag (max 90 characters)'),
});

/** Escape Room: put steps in order. */
export const OrderSchema = QuestionBase.extend({
  type: z.literal('order'),
  prompt: nonEmpty('prompt'),
  steps: z.array(nonEmpty('step')).min(3, 'order questions need at least 3 steps'),
});

/** Escape Room: code lock. A short typed fact. */
export const CodeSchema = QuestionBase.extend({
  type: z.literal('code'),
  prompt: nonEmpty('prompt'),
  answer: nonEmpty('answer'),
  /** Other spellings that should also unlock. Matching ignores case and punctuation. */
  accept: z.array(z.string()).optional(),
});

/** Escape Room: last door. Two or three sentences in the student's own words. */
export const ExplainSchema = QuestionBase.extend({
  type: z.literal('explain'),
  prompt: nonEmpty('prompt'),
  modelAnswer: nonEmpty('modelAnswer'),
  /** Optional notes per SOLO level, used for self-scoring. */
  rubric: z
    .object({
      unistructural: z.string().optional(),
      multistructural: z.string().optional(),
      relational: z.string().optional(),
      extendedAbstract: z.string().optional(),
    })
    .optional(),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  McqSchema,
  SliceItemSchema,
  OrderSchema,
  CodeSchema,
  ExplainSchema,
]);

export const TopicSchema = z.object({
  id,
  title: nonEmpty('topic title'),
  blurb: z.string().optional(),
});

export const ConceptSchema = z.object({
  id,
  topic: id,
  name: nonEmpty('concept name'),
  /** Short label for tight spaces like the mastery map. */
  short: nonEmpty('concept short name').max(28, 'concept short name max 28 characters'),
  definition: nonEmpty('concept definition'),
});

/** Concepts that are easy to confuse. Fruit Slice draws one group per round. */
export const SliceGroupSchema = z.object({
  id,
  title: nonEmpty('slice group title'),
  concepts: z.array(id).min(2, 'a slice group needs at least 2 concepts to tell apart'),
});

export const DeckSchema = z
  .object({
    id,
    title: nonEmpty('deck title'),
    description: z.string(),
    author: z.string(),
    version: z.number().int().positive(),
    /** True for the development sample. The app shows a banner when this is set. */
    placeholder: z.boolean().optional(),
    topics: z.array(TopicSchema).min(1),
    concepts: z.array(ConceptSchema).min(1),
    sliceGroups: z.array(SliceGroupSchema),
    questions: z.array(QuestionSchema).min(1),
  })
  .superRefine((deck, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });

    const unique = (ids: string[], label: string, path: string) => {
      const seen = new Set<string>();
      ids.forEach((v, i) => {
        if (seen.has(v)) issue(`duplicate ${label} id "${v}"`, [path, i, 'id']);
        seen.add(v);
      });
    };
    unique(deck.topics.map((t) => t.id), 'topic', 'topics');
    unique(deck.concepts.map((c) => c.id), 'concept', 'concepts');
    unique(deck.sliceGroups.map((g) => g.id), 'slice group', 'sliceGroups');
    unique(deck.questions.map((q) => q.id), 'question', 'questions');

    const topicIds = new Set(deck.topics.map((t) => t.id));
    const conceptIds = new Set(deck.concepts.map((c) => c.id));
    const groups = new Map(deck.sliceGroups.map((g) => [g.id, g]));

    deck.concepts.forEach((c, i) => {
      if (!topicIds.has(c.topic)) issue(`concept "${c.id}" points at unknown topic "${c.topic}"`, ['concepts', i, 'topic']);
    });
    deck.sliceGroups.forEach((g, i) => {
      g.concepts.forEach((c, j) => {
        if (!conceptIds.has(c)) issue(`slice group "${g.id}" lists unknown concept "${c}"`, ['sliceGroups', i, 'concepts', j]);
      });
    });

    deck.questions.forEach((q, i) => {
      if (!conceptIds.has(q.concept)) issue(`question "${q.id}" points at unknown concept "${q.concept}"`, ['questions', i, 'concept']);

      if (q.type === 'mcq') {
        const texts = [q.answer, ...q.distractors.map((d) => d.text)].map((t) => t.trim().toLowerCase());
        if (new Set(texts).size !== texts.length) issue(`question "${q.id}" has a distractor identical to the answer or another distractor`, ['questions', i]);
      }
      if (q.type === 'slice') {
        const g = groups.get(q.group);
        if (!g) issue(`slice item "${q.id}" points at unknown group "${q.group}"`, ['questions', i, 'group']);
        else if (!g.concepts.includes(q.concept))
          issue(`slice item "${q.id}" has concept "${q.concept}", which isn't in group "${q.group}"`, ['questions', i, 'concept']);
      }
    });

    // Every concept in a slice group needs items, or a round targeting it would have nothing to slice.
    deck.sliceGroups.forEach((g, i) => {
      g.concepts.forEach((c) => {
        const n = deck.questions.filter((q) => q.type === 'slice' && q.group === g.id && q.concept === c).length;
        if (n < 2) issue(`slice group "${g.id}" needs at least 2 items for concept "${c}" (has ${n})`, ['sliceGroups', i]);
      });
    });
  });

export type Deck = z.infer<typeof DeckSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Mcq = z.infer<typeof McqSchema>;
export type SliceItem = z.infer<typeof SliceItemSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type SliceGroup = z.infer<typeof SliceGroupSchema>;
export type QuestionType = Question['type'];

/** Readable list of problems, one per line, with the JSON path that caused each. */
export function formatDeckErrors(error: z.ZodError): string[] {
  return error.issues.map((iss) => {
    const path = iss.path.length ? iss.path.join('.') : '(deck)';
    return `${path}: ${iss.message}`;
  });
}
