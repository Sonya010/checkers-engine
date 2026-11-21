import { Move, Position } from '../rules/types.js';
import { Bot, RandomBotOptions } from './types.js';

export class DeterministicPrng {
  private state: number;

  constructor(seed: number = 1) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 1) {
      return 0;
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }
}

export class RandomBot implements Bot {
  private readonly rng: DeterministicPrng;
  readonly seed: number;

  constructor(seedOrOptions: number | RandomBotOptions = 1) {
    const resolvedSeed =
      typeof seedOrOptions === 'number'
        ? seedOrOptions
        : (seedOrOptions.seed ?? 1);
    this.seed = resolvedSeed;
    this.rng = new DeterministicPrng(resolvedSeed);
  }

  chooseMove(position: Position): Move {
    const moves = position.legalMoves();
    if (moves.length === 0) {
      throw new Error('RandomBot cannot choose a move: no legal moves available');
    }
    const index = this.rng.nextInt(moves.length);
    return moves[index];
  }
}

