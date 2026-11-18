import { Color, Piece, Square } from './types.js';

class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint = 0x123456789abcdef0n) {
    this.state = seed;
  }

  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }
}

export interface ZobristTable {
  readonly pieceKeys: readonly (readonly bigint[])[];
  readonly blackTurnKey: bigint;
  getPieceKey(sq: Square, piece: Piece): bigint;
}

const PIECE_INDEX_WHITE_MAN = 0;
const PIECE_INDEX_WHITE_KING = 1;
const PIECE_INDEX_BLACK_MAN = 2;
const PIECE_INDEX_BLACK_KING = 3;

function pieceToIndex(piece: Piece): number {
  if (piece.color === 'white') {
    return piece.kind === 'man' ? PIECE_INDEX_WHITE_MAN : PIECE_INDEX_WHITE_KING;
  }
  return piece.kind === 'man' ? PIECE_INDEX_BLACK_MAN : PIECE_INDEX_BLACK_KING;
}

class ZobristTableImpl implements ZobristTable {
  readonly pieceKeys: readonly (readonly bigint[])[];
  readonly blackTurnKey: bigint;

  constructor(maxSquares: number = 50) {
    const rng = new SplitMix64(0xfeedfacecafebaben);
    const keys: bigint[][] = [];

    for (let sq = 0; sq < maxSquares; sq++) {
      const sqKeys: bigint[] = [];
      for (let p = 0; p < 4; p++) {
        sqKeys.push(rng.next());
      }
      keys.push(Object.freeze(sqKeys) as bigint[]);
    }

    this.pieceKeys = Object.freeze(keys);
    this.blackTurnKey = rng.next();
  }

  getPieceKey(sq: Square, piece: Piece): bigint {
    const pIdx = pieceToIndex(piece);
    return this.pieceKeys[sq][pIdx];
  }
}

export const defaultZobristTable: ZobristTable = new ZobristTableImpl(50);

export function computePositionKey(
  pieces: readonly (Piece | null)[],
  turn: Color,
  table: ZobristTable = defaultZobristTable,
): bigint {
  let key = 0n;
  for (let sq = 0; sq < pieces.length; sq++) {
    const piece = pieces[sq];
    if (piece !== null) {
      key ^= table.getPieceKey(sq, piece);
    }
  }
  if (turn === 'black') {
    key ^= table.blackTurnKey;
  }
  return key;
}

