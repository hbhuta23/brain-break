# Writing a deck

Every game in Brain Break reads from one deck file. Drop a `.json` file into
`src/content/decks/`. The app finds it automatically, checks it, and lists it
in onboarding and Settings. Start from [`deck-template.json`](deck-template.json).

Check your deck any time with:

```bash
npm run validate-deck
```

It prints every problem with the exact path, e.g.
`questions.12.distractors: mcq needs at least 2 distractors`. If the app is
running, a broken deck also shows a "Deck problems" panel in the corner
instead of failing silently.

---

## The shape of a deck

```jsonc
{
  "id": "module-1",                 // lowercase-with-dashes
  "title": "CS 6460 · Module 1",
  "description": "Memory, motivation, constructivism",
  "author": "Your name",
  "version": 1,
  "topics":      [ ... ],           // the "worlds" on the mastery map
  "concepts":    [ ... ],           // the "levels"; what mastery is tracked on
  "sliceGroups": [ ... ],           // sets of look-alike concepts for Fruit Slice
  "questions":   [ ... ]
}
```

### Topics

```json
{ "id": "memory", "title": "Memory & Cognitive Load", "blurb": "optional one-liner" }
```

### Concepts

```json
{
  "id": "negative-reinforcement",
  "topic": "motivation",
  "name": "Negative reinforcement",
  "short": "Negative reinforcement",
  "definition": "Removing something after a behavior so that the behavior increases."
}
```

`short` (max 28 characters) is used on the mastery map. `definition` appears
in Fruit Slice feedback ("You were looking for X: definition"), so write it
the way you'd explain it to a classmate.

### Slice groups

Concepts that students confuse with each other. Each Fruit Slice round picks
one group, names one concept as the target, and throws examples of *all*
the group's concepts.

```json
{ "id": "reinforcement", "title": "Reinforcement vs punishment",
  "concepts": ["positive-reinforcement", "negative-reinforcement", "positive-punishment", "negative-punishment"] }
```

Every concept in a group needs **at least 2 slice items** (aim for 3+).

---

## Questions

Every question has these fields:

| Field | Required | Notes |
|---|---|---|
| `id` | ✓ | unique, lowercase-with-dashes |
| `type` | ✓ | `mcq`, `slice`, `order`, `code`, `explain` |
| `concept` | ✓ | a concept id |
| `bloom` | ✓ | `remember` `understand` `apply` `analyze` `evaluate` `create` |
| `source.passage` | ✓ | the bit of the notes this came from (shown in feedback and hints) |
| `source.ref` | ✓ | where it is, e.g. `"Module 1 · Lesson 3: Cognitive Load"` |
| `explanation` | ✓ | shown after every answer. Teach the idea, don't just restate the answer |
| `pretest` | | `true` on **exactly 10** multiple-choice questions |

> **Mastery needs an apply-level question.** A concept only counts as
> mastered once the student gets an `apply` (or higher) question right, so
> every concept should have at least one `apply` question, usually a
> `scenario` MCQ.

### `mcq`: Lane Runner, pretest, Escape Room scenario locks

```json
{
  "id": "reinf-02", "type": "mcq", "format": "scenario",
  "concept": "negative-reinforcement", "bloom": "apply",
  "stem": "Your car beeps until you buckle up. Soon you buckle up right away. This is…",
  "answer": "Negative reinforcement",
  "distractors": [
    { "text": "Positive punishment",
      "misconception": "The beep is annoying, but buckling goes UP, so it's reinforcement." },
    { "text": "Negative punishment",
      "misconception": "Punishment makes behavior go down. Here buckling increases." }
  ],
  "explanation": "An unpleasant stimulus is removed when you buckle, so buckling increases.",
  "source": { "passage": "…", "ref": "Module 1 · Lesson 2" }
}
```

- `format`: `"fact"` (straight recall) or `"scenario"` (a situation; which principle is it?).
- **Each distractor needs a `misconception`**: why someone would pick it and why it's
  wrong. This is what the student sees when they choose it, so it's the
  most important text in the deck.
- **Lane Runner limits:** to appear on the gates, the answer and at least 2
  distractors must be **≤ 40 characters**, and the stem **≤ 170**.
  Longer MCQs still work in the pretest and the Escape Room.
- 2–4 distractors. Lane Runner uses the first two that fit.

### `slice`: Fruit Slice items

```json
{ "id": "slice-nr-01", "type": "slice", "group": "reinforcement",
  "concept": "negative-reinforcement", "bloom": "understand",
  "text": "The car stops beeping once you buckle up, so you buckle faster.",
  "explanation": "The beep is removed and buckling goes up: negative reinforcement.",
  "source": { "passage": "…", "ref": "…" } }
```

- `text` max **90 characters**. It has to fit on a fruit's tag while flying.
- The `explanation` should say *why it belongs to its own concept*. When a
  student slices it as the wrong concept, they see this.

### Escape Room types (built for Milestone 2, but you can write them now)

```jsonc
// Ordering lock
{ "id": "hr-order", "type": "order", "concept": "interest-development", "bloom": "understand",
  "prompt": "Put Hidi & Renninger's four phases of interest in order.",
  "steps": ["Triggered situational", "Maintained situational", "Emerging individual", "Well-developed individual"],
  "explanation": "…", "source": { "passage": "…", "ref": "…" } }

// Code lock: a short typed fact. Matching ignores case and punctuation.
{ "id": "zpd-code", "type": "code", "concept": "zpd", "bloom": "remember",
  "prompt": "Who described the zone of proximal development?",
  "answer": "Vygotsky", "accept": ["Lev Vygotsky"],
  "explanation": "…", "source": { "passage": "…", "ref": "…" } }

// Last door: explain in your own words, scored against a model answer (SOLO)
{ "id": "scaffold-door", "type": "explain", "concept": "scaffolding", "bloom": "analyze",
  "prompt": "Explain why scaffolding needs to fade, in 2–3 sentences.",
  "modelAnswer": "…",
  "rubric": { "unistructural": "…", "multistructural": "…", "relational": "…", "extendedAbstract": "…" },
  "explanation": "…", "source": { "passage": "…", "ref": "…" } }
```

---

## Checklist for the Module 1 deck (~60 questions)

- [ ] 3 topics, and the concepts under each
- [ ] Every concept has ≥ 1 `apply`-level question
- [ ] Exactly 10 `"pretest": true` MCQs, spread across all three topics
- [ ] ≥ 6 MCQs short enough for Lane Runner (more is better; aim for 20+)
- [ ] At least 1–2 slice groups, ≥ 2 items per concept in each (3+ is better)
- [ ] Every distractor has a real misconception, not just "this is wrong"
- [ ] `npm run validate-deck` passes

When the deck is in, delete `sample.json` (or keep it; real decks are listed first).
