import { getBoardGeometry } from './board.js';
import { createCustomPosition, oppositeColor } from './position.js';
import { Move, Piece, Position, Square } from './types.js';

export function rotateSquare180(sq: Square, boardSize: 8 | 10): Square {
  const geometry = getBoardGeometry(boardSize);
  return geometry.squareCount - 1 - sq;
}

export function rotateMove180(move: Move, boardSize: 8 | 10): Move {
  return {
    from: rotateSquare180(move.from, boardSize),
    path: move.path.map((sq) => rotateSquare180(sq, boardSize)),
    captured: move.captured.map((sq) => rotateSquare180(sq, boardSize)),
    promotes: move.promotes,
  };
}

export function rotatePosition180(position: Position): Position {
  const boardSize = position.rules.boardSize;
  const geometry = getBoardGeometry(boardSize);
  const rotatedPieces: (Piece | null)[] = Array.from(
    { length: geometry.squareCount },
    () => null,
  );

  for (let sq = 0; sq < geometry.squareCount; sq++) {
    const piece = position.pieceAt(sq);
    if (piece !== null) {
      const targetSq = rotateSquare180(sq, boardSize);
      rotatedPieces[targetSq] = {
        color: oppositeColor(piece.color),
        kind: piece.kind,
      };
    }
  }

  return createCustomPosition({
    rules: position.rules,
    pieces: rotatedPieces,
    turn: oppositeColor(position.turn),
  });
}

