import { IllegalMoveError } from './errors.js';
import { createInitialPosition } from './position.js';
import { GameStatus, Move, Position, Rules } from './types.js';

export interface GameHistoryEntry {
  readonly move: Move;
  readonly positionBefore: Position;
  readonly positionAfter: Position;
}

export class Game {
  private currentPosition: Position;
  private readonly initialPosition: Position;
  private readonly history: GameHistoryEntry[] = [];
  private readonly keyCounts = new Map<bigint, number>();

  constructor(rulesOrPosition: Rules | Position) {
    if ('pieceAt' in rulesOrPosition) {
      this.initialPosition = rulesOrPosition;
    } else {
      this.initialPosition = createInitialPosition(rulesOrPosition);
    }
    this.currentPosition = this.initialPosition;
    this.recordPositionKey(this.currentPosition.key);
  }

  get position(): Position {
    return this.currentPosition;
  }

  get rules(): Rules {
    return this.currentPosition.rules;
  }

  get moves(): readonly Move[] {
    return this.history.map((h) => h.move);
  }

  get entries(): readonly GameHistoryEntry[] {
    return [...this.history];
  }

  play(move: Move): void {
    const currentStatus = this.status();
    if (currentStatus.kind !== 'ongoing') {
      throw new IllegalMoveError(
        `Cannot play move when game status is ${currentStatus.kind}`,
      );
    }

    const nextPosition = this.currentPosition.apply(move);
    this.history.push({
      move: {
        from: move.from,
        path: [...move.path],
        captured: [...move.captured],
        promotes: move.promotes,
      },
      positionBefore: this.currentPosition,
      positionAfter: nextPosition,
    });

    this.currentPosition = nextPosition;
    this.recordPositionKey(nextPosition.key);
  }

  status(): GameStatus {
    const repetitionLimit = this.currentPosition.rules.draw.repetitionCount;
    const occurrences = this.keyCounts.get(this.currentPosition.key) ?? 0;

    if (occurrences >= repetitionLimit) {
      return {
        kind: 'draw',
        reason: 'repetition',
      };
    }

    return this.currentPosition.status();
  }

  repetitionCount(key: bigint = this.currentPosition.key): number {
    return this.keyCounts.get(key) ?? 0;
  }

  private recordPositionKey(key: bigint): void {
    const prev = this.keyCounts.get(key) ?? 0;
    this.keyCounts.set(key, prev + 1);
  }
}

