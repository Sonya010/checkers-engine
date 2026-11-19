import { describe, expect, it } from 'vitest';
import { formatMove } from '../../../src/notation/move-notation.js';
import { parseSquareAlgebraic } from '../../../src/notation/coordinates.js';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { englishRules, ukrainianRules } from '../../../src/rules/variants/index.js';

const sq = (coord: string) => parseSquareAlgebraic(coord, 8);

describe('MoveGenerator capture rules', () => {
  it('enforces mandatory capture and suppresses quiet moves', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('c3'), sq('g3'))
      .blackMan(sq('d4'))
      .build();

    const moves = pos.legalMoves();
    expect(moves).toHaveLength(1);
    expect(formatMove(moves[0], ukrainianRules)).toBe('c3:e5');
    expect(moves[0].captured).toEqual([sq('d4')]);
  });

  it('allows men to capture backward in Ukrainian rules', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('e5'))
      .blackMan(sq('d4'))
      .build();

    const moves = pos.legalMoves();
    expect(moves).toHaveLength(1);
    expect(formatMove(moves[0], ukrainianRules)).toBe('e5:c3');
  });

  it('forbids men from capturing backward in English rules', () => {
    const pos = new BoardBuilder(englishRules)
      .turn('white')
      .whiteMan(sq('e5'))
      .blackMan(sq('d4'))
      .build();

    const moves = pos.legalMoves();
    expect(moves.every((m) => m.captured.length === 0)).toBe(true);
    expect(moves).toHaveLength(2);
  });

  it('requires completing the full multi-jump capture sequence', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('a3'))
      .blackMan(sq('b4'), sq('d6'), sq('d4'))
      .build();

    const moves = pos.legalMoves();
    const formatted = moves.map((m) => formatMove(m, ukrainianRules)).sort();
    expect(formatted).toEqual(['a3:c5:e3', 'a3:c5:e7']);
  });

  it('enforces Turkish strike rule where captured pieces remain on board and block landing during move', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('h2'))
      .blackMan(sq('f4'), sq('c5'), sq('c3'), sq('e3'))
      .build();

    const moves = pos.legalMoves();
    const formatted = moves.map((m) => formatMove(m, ukrainianRules)).sort();
    expect(formatted).toEqual([
      'h2:d6:b4:d2',
      'h2:d6:b4:e1',
      'h2:e5:a1',
      'h2:e5:b2',
    ]);
    for (const move of moves) {
      expect(move.captured).not.toContain(sq('e3'));
      expect(move.path).not.toContain(sq('f4'));
    }
  });

  it('prohibits jumping over the same opponent piece twice in a diamond loop', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('c3'))
      .blackMan(sq('d4'), sq('f4'), sq('f2'), sq('d2'))
      .build();

    const moves = pos.legalMoves();
    expect(moves).toHaveLength(2);
    for (const m of moves) {
      expect(m.captured).toHaveLength(4);
      expect(new Set(m.captured).size).toBe(4);
    }
  });
});