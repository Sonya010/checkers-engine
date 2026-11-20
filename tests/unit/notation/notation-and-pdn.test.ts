import { describe, expect, it } from 'vitest';
import {
  formatSquare,
  formatSquareAlgebraic,
  formatSquareNumeric,
  parseSquareAlgebraic,
  parseSquareNumeric,
} from '../../../src/notation/coordinates.js';
import { ParseError } from '../../../src/notation/errors.js';
import { formatMove, parseMove } from '../../../src/notation/move-notation.js';
import { formatPdn } from '../../../src/notation/pdn/formatter.js';
import { parsePdn, replayPdn } from '../../../src/notation/pdn/parser.js';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { createInitialPosition } from '../../../src/rules/position.js';
import { englishRules, ukrainianRules } from '../../../src/rules/variants/index.js';

describe('Coordinates, Move Notation, and PDN', () => {
  it('converts dark square indices to and from algebraic coordinates (a1-h8)', () => {
    expect(formatSquareAlgebraic(0, 8)).toBe('b8');
    expect(formatSquareAlgebraic(21, 8)).toBe('c3');
    expect(formatSquareAlgebraic(28, 8)).toBe('a1');
    expect(formatSquare(21, ukrainianRules)).toBe('c3');

    expect(parseSquareAlgebraic('b8', 8)).toBe(0);
    expect(parseSquareAlgebraic('c3', 8)).toBe(21);
    expect(parseSquareAlgebraic('a1', 8)).toBe(28);
    expect(() => parseSquareAlgebraic('a2', 8)).toThrow(ParseError);
  });

  it('converts dark square indices to and from numeric coordinates (1-32)', () => {
    expect(formatSquareNumeric(0, 8)).toBe('1');
    expect(formatSquareNumeric(21, 8)).toBe('22');
    expect(formatSquareNumeric(31, 8)).toBe('32');
    expect(formatSquare(21, englishRules)).toBe('22');

    expect(parseSquareNumeric('1', 8)).toBe(0);
    expect(parseSquareNumeric('22', 8)).toBe(21);
    expect(parseSquareNumeric('32', 8)).toBe(31);
    expect(() => parseSquareNumeric('33', 8)).toThrow(ParseError);
  });

  it('formats quiet moves in both Ukrainian algebraic and English numeric notation', () => {
    const uaInitial = createInitialPosition(ukrainianRules);
    const uaMove = uaInitial.legalMoves().find(
      (m) => m.from === 21 && m.path[0] === 17,
    )!;
    expect(formatMove(uaMove, ukrainianRules)).toBe('c3-d4');

    const enInitial = createInitialPosition(englishRules);
    const enMove = enInitial.legalMoves().find(
      (m) => m.from === 10 && m.path[0] === 14,
    )!;
    expect(formatMove(enMove, englishRules)).toBe('11-15');
  });

  it('formats multi-jump capture sequences with intermediate landing squares', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(parseSquareAlgebraic('a3', 8))
      .blackMan(parseSquareAlgebraic('b4', 8), parseSquareAlgebraic('d6', 8))
      .build();

    const moves = pos.legalMoves();
    expect(moves).toHaveLength(1);
    expect(formatMove(moves[0], ukrainianRules)).toBe('a3:c5:e7');
    expect(formatMove(moves[0], englishRules)).toBe('21x14x7');
  });

  it('parses valid quiet and capture moves into Move objects', () => {
    const uaPos = createInitialPosition(ukrainianRules);
    const parsedQuiet = parseMove('c3-d4', uaPos);
    expect(parsedQuiet.from).toBe(21);
    expect(parsedQuiet.path).toEqual([17]);
    expect(parsedQuiet.captured).toEqual([]);

    const capPos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(parseSquareAlgebraic('a3', 8))
      .blackMan(parseSquareAlgebraic('b4', 8), parseSquareAlgebraic('d6', 8))
      .build();

    const parsedFullCapture = parseMove('a3:c5:e7', capPos);
    expect(parsedFullCapture.captured).toHaveLength(2);

    const parsedShortCapture = parseMove('a3:e7', capPos);
    expect(parsedShortCapture).toEqual(parsedFullCapture);
  });

  it('throws ParseError with line and column on malformed or illegal moves', () => {
    const uaPos = createInitialPosition(ukrainianRules);
    expect(() => parseMove('invalid', uaPos, 3, 5)).toThrow(ParseError);
    expect(() => parseMove('c3-c5', uaPos, 2, 1)).toThrow(ParseError);

    try {
      parseMove('c3:d4', uaPos, 4, 10);
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError);
      const parseErr = err as ParseError;
      expect(parseErr.line).toBe(4);
      expect(parseErr.column).toBe(10);
    }
  });

  it('parses PDN headers and metadata accurately', () => {
    const pdnText = [
      '[Event "Championship"]',
      '[White "Player A"]',
      '[Black "Player B"]',
      '[Rules "ukrainian"]',
      '[Result "1-0"]',
      '',
      '1. c3-d4 b6-a5 2. d4-c5 d6:b4 3. a3:c5 1-0',
    ].join('\n');

    const parsed = parsePdn(pdnText);
    expect(parsed.headers.Event).toBe('Championship');
    expect(parsed.headers.White).toBe('Player A');
    expect(parsed.headers.Black).toBe('Player B');
    expect(parsed.headers.Rules).toBe('ukrainian');
    expect(parsed.result).toBe('1-0');
    expect(parsed.moves).toEqual(['c3-d4', 'b6-a5', 'd4-c5', 'd6:b4', 'a3:c5']);
  });

  it('replays a parsed PDN game and round-trips through formatPdn', () => {
    const pdnText = [
      '[Event "Test Match"]',
      '[White "WhiteBot"]',
      '[Black "BlackBot"]',
      '[Rules "ukrainian"]',
      '[Result "*"]',
      '',
      '1. c3-d4 b6-a5 2. d4-c5 d6:b4 3. a3:c5 *',
    ].join('\n');

    const replayed = replayPdn(pdnText);
    expect(replayed.appliedMoves).toHaveLength(5);

    const formatted = formatPdn(replayed.pdn);
    const reparsed = parsePdn(formatted);
    expect(reparsed.moves).toEqual(replayed.pdn.moves);
    expect(reparsed.headers.Event).toBe('Test Match');
  });
});

