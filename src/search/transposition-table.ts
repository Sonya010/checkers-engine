import { Move } from '../rules/types.js';

export type BoundFlag = 'exact' | 'lowerbound' | 'upperbound';

export interface TranspositionEntry {
  readonly key: bigint;
  readonly depth: number;
  readonly score: number;
  readonly flag: BoundFlag;
  readonly bestMove: Move | null;
}

export class TranspositionTable {
  private readonly table = new Map<bigint, TranspositionEntry>();
  private readonly maxEntries: number;
  private hits = 0;
  private stores = 0;

  constructor(maxEntries: number = 100000) {
    this.maxEntries = Math.max(128, maxEntries);
  }

  get size(): number {
    return this.table.size;
  }

  get hitCount(): number {
    return this.hits;
  }

  get storeCount(): number {
    return this.stores;
  }

  lookup(key: bigint): TranspositionEntry | undefined {
    const entry = this.table.get(key);
    if (entry !== undefined) {
      this.hits++;
    }
    return entry;
  }

  store(entry: TranspositionEntry): void {
    const existing = this.table.get(entry.key);
    if (existing !== undefined && existing.depth > entry.depth) {
      return;
    }

    if (!existing && this.table.size >= this.maxEntries) {
      const firstKey = this.table.keys().next().value;
      if (firstKey !== undefined) {
        this.table.delete(firstKey);
      }
    }

    this.table.set(entry.key, {
      key: entry.key,
      depth: entry.depth,
      score: entry.score,
      flag: entry.flag,
      bestMove: entry.bestMove
        ? {
            from: entry.bestMove.from,
            path: [...entry.bestMove.path],
            captured: [...entry.bestMove.captured],
            promotes: entry.bestMove.promotes,
          }
        : null,
    });
    this.stores++;
  }

  clear(): void {
    this.table.clear();
    this.hits = 0;
    this.stores = 0;
  }
}

