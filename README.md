# Brain Break

Arcade games where every move is a retrieval-practice question, on a shared
spaced-repetition schedule. Built for CS 6460 (Educational Technology),
Fall 2026.

- **Lane Runner**, a Run 3 homage: run through the gate with the right answer.
  Quick recall (Bloom: Remember).
- **Fruit Slice**, a Fruit Ninja homage: slice examples of one concept and let
  the look-alikes fall. Telling concepts apart (Bloom: Understand).
- **Escape Room**, a classic Flash "escape the room" homage: apply ideas to
  open locks, then explain one to get out (Bloom: Apply/Analyze).
  *In progress for Milestone 2.*

All art and sound is original: procedural canvas/SVG art and synthesized
Web Audio. No accounts. Progress is saved in the browser.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # engine + deck tests
npm run validate-deck  # check every deck in src/content/decks
npm run build          # typecheck + production build to dist/
```

Deploys to Vercel as a static site (`vercel.json` handles client-side routes).

## How it works

```
src/
  content/       deck schema (zod), deck registry, decks/*.json
  engine/        pure TypeScript, unit-tested
    leitner.ts     5-box Leitner schedule (0/1/2/4/7 days), squeezed before the exam date
    scheduler.ts   which cards each game gets (from each question's `games`); misses come back in a *different* game
    mastery.ts     criterion-referenced mastery: 3 correct, 2 days, 2 kinds, 1 apply-level
    events.ts      everything recorded for evaluation, plus CSV export
  store/         zustand + localStorage persistence
  games/         Phaser 4 scenes + a typed React<->Phaser bridge
  screens/       onboarding, pretest, hub, mastery map, settings, game screen + results
docs/
  DECK_FORMAT.md   how to write a deck
  TIMELINE.md      revised week-by-week plan
```

**Adding a deck:** the Module 1 deck lives at `src/content/decks/module1.json`. Drop another JSON file there and run
`npm run validate-deck`. See [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md).

**Demo tools:** spacing happens over days, so the top bar has *Skip a day*
and Settings can unlock free play early. That lets testers watch missed
questions come back without waiting.
