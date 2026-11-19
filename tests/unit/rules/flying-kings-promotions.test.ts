import { describe, expect, it } from 'vitest';
import { parseSquareAlgebraic } from '../../../src/notation/coordinates.js';
import { formatMove } from '../../../src/notation/move-notation.js';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { englishRules, ukrainianRules } from '../../../src/rules/variants/index.js';

const sq = (coord: string) => parseSquareAlgebraic(coord, 8);

describe('Flying kings and mid-capture promotions', () => {
  it('allows flying king to land on any empty square behind captured piece when no further captures exist', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('a1'))
      .blackMan(sq('c3'))
      .build();

    const moves = pos.legalMoves();
    const formatted = moves.map((m) => formatMove(m, ukrainianRules)).sort();
    expect(formatted).toEqual(['a1:d4', 'a1:e5', 'a1:f6', 'a1:g7', 'a1:h8']);
  });

  it('forces flying king to choose only landing squares that continue the capture sequence', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('a1'))
      .blackMan(sq('c3'), sq('f4'))
      .build();

    const moves = pos.legalMoves();
    const formatted = moves.map((m) => formatMove(m, ukrainianRules)).sort();
    expect(formatted).toEqual(['a1:e5:g3', 'a1:e5:h2']);
  });

  it('promotes man mid-capture on d8 and continues capturing as flying king in Ukrainian rules', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('b6'))
      .blackMan(sq('c7'), sq('f6'))
      .build();

    const moves = pos.legalMoves();
    const formatted = moves.map((m) => formatMove(m, ukrainianRules)).sort();
    expect(formatted).toEqual(['b6:d8:g5', 'b6:d8:h4']);
    expect(moves[0].promotes).toBe(true);
    expect(moves[0].captured).toEqual([sq('c7'), sq('f6')]);
  });

  it('terminates capture sequence immediately upon reaching promotion row in English rules', () => {
    const pos = new BoardBuilder(englishRules)
      .turn('white')
      .whiteMan(sq('b6'))
      .blackMan(sq('c7'), sq('e7'))
      .build();

    const moves = pos.legalMoves();
    expect(moves).toHaveLength(1);
    expect(moves[0].path).toEqual([sq('d8')]);
    expect(moves[0].captured).toEqual([sq('c7')]);
    expect(moves[0].promotes).toBe(true);
  });
});