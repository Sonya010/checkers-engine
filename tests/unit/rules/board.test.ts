import { describe, expect, it } from 'vitest';
import {
  DIR_NE,
  DIR_NW,
  DIR_SE,
  DIR_SW,
  getBoardGeometry,
} from '../../../src/rules/board.js';
import { Piece } from '../../../src/rules/types.js';
import { computePositionKey, defaultZobristTable } from '../../../src/rules/zobrist.js';

describe('Board geometry and Zobrist hashing', () => {
  it('initializes 32 dark squares with odd row+col sum on 8x8 board', () => {
    const geo = getBoardGeometry(8);
    expect(geo.squareCount).toBe(32);
    expect(geo.piecesPerPlayer).toBe(12);
    expect(geo.squares.length).toBe(32);

    for (let sq = 0; sq < 32; sq++) {
      const { row, col } = geo.coords[sq];
      expect((row + col) % 2).toBe(1);
      expect(geo.squareFromCoords(row, col)).toBe(sq);
    }
  });

  it('returns -1 for out-of-bounds neighbors on border squares', () => {
    const geo = getBoardGeometry(8);
    expect(geo.neighbors[0][DIR_NW]).toBe(-1);
    expect(geo.neighbors[0][DIR_NE]).toBe(-1);
    expect(geo.neighbors[3][DIR_NE]).toBe(-1);
    expect(geo.neighbors[3][DIR_SE]).toBe(-1);
    expect(geo.neighbors[28][DIR_NW]).toBe(-1);
    expect(geo.neighbors[28][DIR_SW]).toBe(-1);
    expect(geo.neighbors[31][DIR_SW]).toBe(-1);
    expect(geo.neighbors[31][DIR_SE]).toBe(-1);
  });

  it('computes accurate diagonal neighbors and rays for central squares', () => {
    const geo = getBoardGeometry(8);
    const d4 = geo.squareFromCoords(4, 3);
    expect(d4).toBe(17);

    expect(geo.neighbors[d4][DIR_NW]).toBe(geo.squareFromCoords(3, 2));
    expect(geo.neighbors[d4][DIR_NE]).toBe(geo.squareFromCoords(3, 4));
    expect(geo.neighbors[d4][DIR_SW]).toBe(geo.squareFromCoords(5, 2));
    expect(geo.neighbors[d4][DIR_SE]).toBe(geo.squareFromCoords(5, 4));

    expect(geo.rays[d4][DIR_NE]).toEqual([
      geo.squareFromCoords(3, 4),
      geo.squareFromCoords(2, 5),
      geo.squareFromCoords(1, 6),
      geo.squareFromCoords(0, 7),
    ]);
  });

  it('identifies promotion squares for white and black', () => {
    const geo = getBoardGeometry(8);
    for (let sq = 0; sq < 4; sq++) {
      expect(geo.isPromotionSquare(sq, 'white')).toBe(true);
      expect(geo.isPromotionSquare(sq, 'black')).toBe(false);
    }
    for (let sq = 28; sq < 32; sq++) {
      expect(geo.isPromotionSquare(sq, 'black')).toBe(true);
      expect(geo.isPromotionSquare(sq, 'white')).toBe(false);
    }
    expect(geo.isPromotionSquare(17, 'white')).toBe(false);
    expect(geo.isPromotionSquare(17, 'black')).toBe(false);
  });

  it('produces distinct Zobrist keys when turn or piece changes', () => {
    const emptyPieces: (Piece | null)[] = Array.from(
      { length: 32 },
      () => null,
    );
    const keyWhite = computePositionKey(emptyPieces, 'white', defaultZobristTable);
    const keyBlack = computePositionKey(emptyPieces, 'black', defaultZobristTable);
    expect(keyWhite).not.toBe(keyBlack);

    const withMan: (Piece | null)[] = [...emptyPieces];
    withMan[10] = { color: 'white', kind: 'man' };
    const withKing: (Piece | null)[] = [...emptyPieces];
    withKing[10] = { color: 'white', kind: 'king' };

    expect(computePositionKey(withMan, 'white')).not.toBe(
      computePositionKey(withKing, 'white'),
    );
  });
});
