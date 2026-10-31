# Writing a deck

Every game reads from one deck file. Drop a `.json` file into
`src/content/decks/` and the app picks it up, checks it, and lists it in
onboarding and Settings. The full worked example is the Module 1 deck,
[`src/content/decks/module1.json`](../src/content/decks/module1.json).

```bash
npm run validate-deck
```

prints every problem with its exact path (e.g. `questions.12.passage: question
"mem-13" points at unknown passage "p-x"`) and warns about concepts that can
never be mastered. If the app is running, a broken deck also shows a "Deck
problems" panel instead of failing silently.

## Top level

```jsonc
{
  "id": "cs6460-module1",
  "title": "CS 6460 Module 1: Foundations of the Learning Sciences",
  "version": "0.1.0",
  "source": "Where the passages come from (shown as the deck description)",
  "soloRubric": [ { "level": "relational", "score": 3, "description": "…" } ],
  "topics":    [ ... ],
  "passages":  [ ... ],
  "questions": [ ... ]
}
```

## Topics and concepts

Topics are the worlds on the mastery map. Concepts are listed inside them.

```jsonc
{ "id": "memory", "title": "Memory & Cognitive Load",
  "concepts": [
    "forgetting-spacing",                                   // name made from the id: "Forgetting spacing"
    { "id": "zpd-scaffolding", "name": "ZPD & scaffolding",  // or give a display name
      "short": "ZPD & scaffolding", "definition": "optional one-liner" }
  ] }
```

## Passages

Short excerpts from the notes. Questions point at them by id, and they're
shown as "where this is in your notes" in feedback.

```json
{ "id": "p-mem-forgetting", "source": "Module 1 1.pdf", "lesson": "Cognitivism",
  "section": "Cognitivism and Memory", "text": "First, the forgetting curve showed…" }
```

## Questions

Every question has `id`, `concept`, `type`, `bloom` (`Remember`, `Understand`,
`Apply`, `Analyze`, `Evaluate`, `Create`), `games`, `pretest`, `passage`,
`prompt` and `explanation`.

`games` decides where a question appears:

| `games` value | Where |
|---|---|
| `lane-runner` | Lane Runner gates |
| `fruit-slice` | Fruit Slice (sort sets) |
| `code-lock`, `scenario-lock`, `ordering-lock`, `final-door` | Escape Room (Milestone 2) |

### `recall` and `scenario`: multiple choice

```json
{ "type": "recall", "prompt": "…", "answer": "The spacing effect",
  "distractors": [
    { "text": "Chunking", "misconception": "Any memory term fits",
      "feedback": "Chunking is grouping items into meaningful units. It's about capacity, not timing." } ] }
```

- `misconception` is the short label ("Mix-up: …" in the feedback card, and
  the value logged for analysis). `feedback` is the explanation the learner reads.
- **Lane Runner limits:** answer and at least 2 distractors ≤ 80 characters,
  prompt ≤ 170. Gate text wraps and shrinks, and the question card always
  shows the full text.
- Exactly **10** questions need `"pretest": true`, all `recall` or `scenario`.

### `sort`: one Fruit Slice wave

```json
{ "type": "sort", "prompt": "Slice every source of EXTRANEOUS load",
  "items": [ { "text": "A confusing navigation menu", "match": true, "why": "…" },
             { "text": "Connecting a new idea to what you already know", "match": false, "why": "…" } ] }
```

- Start the prompt with "Slice every …". The sign shows the rest in big letters.
- Item `text` max 90 characters. Each set needs items to slice *and* items to let fall.
- Each item is scheduled as its own card, so a missed fruit comes back on its own.

### `order` and `explain`: Escape Room

```jsonc
{ "type": "order", "steps": ["first", "second", "third"] }          // stored in the correct order
{ "type": "explain", "modelAnswer": "…", "keyIdeas": ["…", "…"] }  // self-scored with soloRubric
```

## Mastery check

A concept is mastered after 3 correct answers, on 2 different days, in 2
kinds of question, with at least one at **Apply or above**. A concept with no
Apply/Analyze question can never be mastered, and the validator warns about it.
