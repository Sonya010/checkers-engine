import { describe, expect, it } from 'vitest';
import { parseSquareAlgebraic } from '../../../src/notation/coordinates.js';
import { parseMove } from '../../../src/notation/move-notation.js';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { IllegalMoveError } from '../../../src/rules/errors.js';
import { Game } from '../../../src/rules/game.js';
import { createInitialPosition } from '../../../src/rules/position.js';
import { ukrainianRules } from '../../../src/rules/variants/index.js';

const sq = (coord: string) => parseSquareAlgebraic(coord, 8);

describe('Position state transitions, wins, draws, and Game repetition', () => {
  it('returns a new immutable Position without mutating the previous position', () => {
    const initial = createInitialPosition(ukrainianRules);
    const move = parseMove('c3-d4', initial);
    const next = initial.apply(move);

    expect(next).not.toBe(initial);
    expect(initial.pieceAt(sq('c3'))).toEqual({ color: 'white', kind: 'man' });
    expect(initial.pieceAt(sq('d4'))).toBeNull();
    expect(next.pieceAt(sq('c3'))).toBeNull();
    expect(next.pieceAt(sq('d4'))).toEqual({ color: 'white', kind: 'man' });
  });

  it('switches turn after applying a legal move', () => {
    const initial = createInitialPosition(ukrainianRules);
    expect(initial.turn).toBe('white');
    const afterWhite = initial.apply(parseMove('c3-d4', initial));
    expect(afterWhite.turn).toBe('black');
    const afterBlack = afterWhite.apply(parseMove('b6-a5', afterWhite));
    expect(afterBlack.turn).toBe('white');
  });

  it('throws IllegalMoveError when attempting to apply an illegal move', () => {
    const initial = createInitialPosition(ukrainianRules);
    expect(() =>
      initial.apply({
        from: sq('c3'),
        path: [sq('c5')],
        captured: [],
        promotes: false,
      }),
    ).toThrow(IllegalMoveError);
  });

  it('declares win when the opponent has no pieces remaining', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('c3'))
      .blackMan(sq('d4'))
      .build();

    const captureMove = parseMove('c3:e5', pos);
    const afterCapture = pos.apply(captureMove);
    expect(afterCapture.status()).toEqual({
      kind: 'win',
      winner: 'white',
    });
  });

  it('declares win when all remaining opponent pieces are completely blocked', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('black')
      .blackMan(sq('h8'))
      .whiteMan(sq('g7'), sq('f6'))
      .build();

    expect(pos.legalMoves()).toHaveLength(0);
    expect(pos.status()).toEqual({
      kind: 'win',
      winner: 'white',
    });
  });

  it('declares draw when kings move 15 times each without capture or man moves', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('a1'))
      .blackKing(sq('b8'))
      .whiteMan(sq('c1'))
      .blackMan(sq('h6'))
      .kingOnlyHalfMoves(29)
      .build();

    expect(pos.status()).toEqual({ kind: 'ongoing' });
    const after30thPly = pos.apply(parseMove('a1-b2', pos));
    expect(after30thPly.status()).toEqual({
      kind: 'draw',
      reason: 'king-moves-limit',
    });
  });

  it('declares draw in Game upon threefold repetition of the same position', () => {
    const startPos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('a1'))
      .blackKing(sq('b8'))
      .whiteMan(sq('c1'))
      .blackMan(sq('h6'))
      .build();

    const game = new Game(startPos);
    expect(game.repetitionCount()).toBe(1);

    for (let cycle = 0; cycle < 2; cycle++) {
      game.play(parseMove('a1-b2', game.position));
      game.play(parseMove('b8-a7', game.position));
      game.play(parseMove('b2-a1', game.position));
      game.play(parseMove('a7-b8', game.position));
    }

    expect(game.repetitionCount()).toBe(3);
    expect(game.status()).toEqual({
      kind: 'draw',
      reason: 'repetition',
    });
  });
});