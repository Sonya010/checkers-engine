import { Move } from '../rules/types.js';

export function sameMove(a: Move, b: Move): boolean {
  if (a.from !== b.from || a.promotes !== b.promotes) {
    return false;
  }
  if (a.path.length !== b.path.length || a.captured.length !== b.captured.length) {
    return false;
  }
  for (let i = 0; i < a.path.length; i++) {
    if (a.path[i] !== b.path[i]) {
      return false;
    }
  }
  for (let i = 0; i < a.captured.length; i++) {
    if (a.captured[i] !== b.captured[i]) {
      return false;
    }
  }
  return true;
}

export function scoreMoveForOrdering(
  move: Move,
  ttBestMove?: Move | null,
): number {
  if (ttBestMove && sameMove(move, ttBestMove)) {
    return 100000;
  }

  let priority = 0;
  if (move.captured.length > 0) {
    priority += 10000 + move.captured.length * 1000;
  }
  if (move.promotes) {
    priority += 5000;
  }
  if (move.path.length > 1) {
    priority += move.path.length * 50;
  }

  return priority;
}

export function orderMoves(
  moves: readonly Move[],
  ttBestMove?: Move | null,
): Move[] {
  if (moves.length <= 1) {
    return [...moves];
  }

  const scored = moves.map((move, index) => ({
    move,
    priority: scoreMoveForOrdering(move, ttBestMove),
    index,
  }));

  scored.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.index - b.index;
  });

  return scored.map((item) => item.move);
}

