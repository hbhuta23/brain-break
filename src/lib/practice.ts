/** The no-stakes practice round from onboarding. Teaches the controls, not content. */
import type { RunnerItem } from '../engine/scheduler';

const base = {
  concept: 'practice',
  conceptName: 'Practice',
  kind: 'recall' as const,
  bloom: 'remember' as const,
  source: { passage: 'This is the practice round, so there are no notes behind it.', ref: 'Tutorial' },
};

export const PRACTICE_ITEMS: RunnerItem[] = [
  {
    ...base,
    cardId: 'practice-1',
    stem: 'Warm-up: run through the gate with a FRUIT on it.',
    options: [
      { text: 'Chair', correct: false, misconception: "A chair isn't a fruit, but now you've seen what a wrong gate does: the game stops and explains." },
      { text: 'Apple', correct: true },
      { text: 'Cloud', correct: false, misconception: "Clouds aren't fruit. Switch lanes with ← → (or A/D, or swipe) before the gate reaches you." },
    ],
    explanation: 'Stay in the middle lane to pick the middle gate.',
  },
  {
    ...base,
    cardId: 'practice-2',
    stem: 'Now switch lanes: which number is even?',
    options: [
      { text: '12', correct: true },
      { text: '7', correct: false, misconception: '7 is odd. Move left to reach the 12 gate.' },
      { text: '9', correct: false, misconception: '9 is odd. Move left twice to reach the 12 gate.' },
    ],
    explanation: '12 divides evenly by 2.',
  },
  {
    ...base,
    cardId: 'practice-3',
    stem: 'Last one. The sun rises in the…',
    options: [
      { text: 'North', correct: false, misconception: 'The sun rises in the east, which is the right-hand gate.' },
      { text: 'West', correct: false, misconception: 'The sun *sets* in the west. It rises in the east.' },
      { text: 'East', correct: true },
    ],
    explanation: "That's the whole game: read, pick your lane, run through.",
  },
];
