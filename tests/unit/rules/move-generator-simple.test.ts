import { describe, expect, it } from 'vitest';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { createInitialPosition } from '../../../src/rules/position.js';
import { englishRules, ukrainianRules } from '../../../src/rules/variants/index.js';

describe('MoveGenerator quiet moves', () => {
  it('generates exactly 7 legal opening moves in Ukrainian and English initial positions', () => {
    const uaPos = createInitialPosition(ukrainianRules);
    expect(uaPos.turn).toBe('white');
    const uaMoves = uaPos.legalMoves();
    expect(uaMoves).toHaveLength(7);
    expect(uaMoves.every((m) => m.captured.length === 0)).toBe(true);

    const enPos = createInitialPosition(englishRules);
    expect(enPos.turn).toBe('black');
    const enMoves = enPos.legalMoves();
    expect(enMoves).toHaveLength(7);
    expect(enMoves.every((m) => m.captured.length === 0)).toBe(true);
  });

  it('blocks quiet moves when target squares are occupied by friendly or enemy pieces', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(21)
      .whiteMan(16)
      .blackMan(18)
      .build();

    const movesFrom21 = pos.legalMoves().filter((m) => m.from === 21);
    expect(movesFrom21).toHaveLength(1);
    expect(movesFrom21[0].path).toEqual([17]);
  });

  it('generates long diagonal slides for flying kings in Ukrainian rules', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(17)
      .blackMan(3)
      .build();

    const kingMoves = pos.legalMoves().filter((m) => m.from === 17);
    const destinations = kingMoves.map((m) => m.path[0]).sort((a, b) => a - b);
    expect(destinations).toEqual([4, 7, 8, 10, 13, 14, 21, 22, 24, 26, 28, 31]);
  });

  it('restricts king quiet moves to 1 step in English rules', () => {
    const pos = new BoardBuilder(englishRules)
      .turn('white')
      .whiteKing(17)
      .blackMan(3)
      .build();

    const kingMoves = pos.legalMoves().filter((m) => m.from === 17);
    const destinations = kingMoves.map((m) => m.path[0]).sort((a, b) => a - b);
    expect(destinations).toEqual([13, 14, 21, 22]);
  });
});