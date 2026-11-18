import { getBoardGeometry } from './board.js';
import { InvalidPositionError } from './errors.js';
import { createCustomPosition } from './position.js';
import { Color, Piece, Position, Rules, Square } from './types.js';

export interface PiecePlacement {
  readonly sq: Square;
  readonly color: Color;
  readonly kind: 'man' | 'king';
}

export class BoardBuilder {
  private readonly rules: Rules;
  private readonly pieces = new Map<Square, Piece>();
  private currentTurn: Color;
  private kingMovesClock: number = 0;
  private endgameClock: number = 0;

  constructor(rules: Rules) {
    this.rules = rules;
    this.currentTurn = rules.firstMover;
  }

  turn(color: Color): this {
    this.currentTurn = color;
    return this;
  }

  kingOnlyHalfMoves(plies: number): this {
    this.kingMovesClock = plies;
    return this;
  }

  endgameHalfMoves(plies: number): this {
    this.endgameClock = plies;
    return this;
  }

  place(sq: Square, color: Color, kind: 'man' | 'king' = 'man'): this {
    const geometry = getBoardGeometry(this.rules.boardSize);
    if (sq < 0 || sq >= geometry.squareCount) {
      throw new InvalidPositionError(`Square ${sq} is out of bounds`);
    }
    this.pieces.set(sq, { color, kind });
    return this;
  }

  whiteMan(...squares: Square[]): this {
    for (const sq of squares) {
      this.place(sq, 'white', 'man');
    }
    return this;
  }

  whiteKing(...squares: Square[]): this {
    for (const sq of squares) {
      this.place(sq, 'white', 'king');
    }
    return this;
  }

  blackMan(...squares: Square[]): this {
    for (const sq of squares) {
      this.place(sq, 'black', 'man');
    }
    return this;
  }

  blackKing(...squares: Square[]): this {
    for (const sq of squares) {
      this.place(sq, 'black', 'king');
    }
    return this;
  }

  remove(sq: Square): this {
    this.pieces.delete(sq);
    return this;
  }

  clear(): this {
    this.pieces.clear();
    return this;
  }

  build(): Position {
    return createCustomPosition({
      rules: this.rules,
      pieces: this.pieces,
      turn: this.currentTurn,
      kingOnlyHalfMoves: this.kingMovesClock,
      endgameHalfMoves: this.endgameClock,
    });
  }
}

export function positionFromAscii(
  rules: Rules,
  asciiGrid: string,
  turn: Color = rules.firstMover,
): Position {
  const geometry = getBoardGeometry(rules.boardSize);
  const tokens = asciiGrid
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const pieces = new Map<Square, Piece>();

  if (tokens.length === geometry.squareCount) {
    for (let sq = 0; sq < geometry.squareCount; sq++) {
      const piece = parsePieceToken(tokens[sq]);
      if (piece !== null) {
        pieces.set(sq, piece);
      }
    }
  } else if (tokens.length === rules.boardSize * rules.boardSize) {
    for (let r = 0; r < rules.boardSize; r++) {
      for (let c = 0; c < rules.boardSize; c++) {
        const token = tokens[r * rules.boardSize + c];
        const piece = parsePieceToken(token);
        if (piece !== null) {
          const sq = geometry.squareFromCoords(r, c);
          if (sq === -1) {
            throw new InvalidPositionError(
              `Piece token '${token}' placed on light square at (${r}, ${c})`,
            );
          }
          pieces.set(sq, piece);
        }
      }
    }
  } else {
    throw new InvalidPositionError(
      `ASCII grid has ${tokens.length} tokens, expected ${geometry.squareCount} or ${rules.boardSize * rules.boardSize}`,
    );
  }

  return createCustomPosition({
    rules,
    pieces,
    turn,
  });
}

function parsePieceToken(token: string): Piece | null {
  switch (token) {
    case 'w':
      return { color: 'white', kind: 'man' };
    case 'W':
      return { color: 'white', kind: 'king' };
    case 'b':
      return { color: 'black', kind: 'man' };
    case 'B':
      return { color: 'black', kind: 'king' };
    case '.':
    case '-':
    case '_':
      return null;
    default:
      throw new InvalidPositionError(`Unrecognized piece token: '${token}'`);
  }
}

