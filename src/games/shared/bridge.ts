/**
 * Typed message bus between a Phaser scene and the React screen around it.
 * Scenes own the gameplay; React owns text-heavy UI (question stems,
 * feedback cards), the store, and logging.
 */
import type { RunnerItem, RunnerOption, SliceTarget, SliceWave } from '../../engine/scheduler';
import type { Settings } from '../../store/useApp';

export interface Feedback {
  tone: 'wrong' | 'missed' | 'info';
  title: string;
  /** What the learner picked, when it was a wrong choice. */
  chosen?: string;
  correct?: string;
  /** Why the chosen answer was wrong (written from the misconception). */
  misconception?: string;
  explanation: string;
  source?: { passage: string; ref: string };
  /** For a review of several items at once (Fruit Slice wave review). */
  items?: { text: string; note: string }[];
}

export interface BridgeEvents {
  ready: void;
  'runner:question': { index: number; total: number; item: RunnerItem };
  'runner:lane': { lane: number };
  'runner:answer': { item: RunnerItem; option: RunnerOption; rtMs: number; speed: number };
  'runner:stats': { streak: number; distance: number; correct: number; answered: number; speed: number; level: number };
  'slice:wave': { index: number; total: number; wave: SliceWave };
  'slice:result': { item: SliceTarget; target: string; sliced: boolean; correct: boolean; rtMs: number };
  'slice:stats': { score: number; strikes: number; combo: number };
  feedback: Feedback;
  end: { reason: 'complete' | 'quit' | 'out-of-lives' };
  // React -> scene
  resume: void;
  'move-lane': { lane: number };
}

type Handler<T> = (payload: T) => void;

export class Bridge {
  private handlers = new Map<keyof BridgeEvents, Set<Handler<never>>>();

  constructor(public settings: Settings) {}

  on<K extends keyof BridgeEvents>(type: K, fn: Handler<BridgeEvents[K]>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(fn as Handler<never>);
    this.handlers.set(type, set);
    return () => set.delete(fn as Handler<never>);
  }

  emit<K extends keyof BridgeEvents>(type: K, ...payload: BridgeEvents[K] extends void ? [] : [BridgeEvents[K]]): void {
    this.handlers.get(type)?.forEach((fn) => (fn as Handler<unknown>)(payload[0]));
  }

  clear() {
    this.handlers.clear();
  }
}
