import { describe, expect, it } from 'vitest';
import { parseSquareAlgebraic } from '../../../src/notation/coordinates.js';
import { formatMove } from '../../../src/notation/move-notation.js';
import { BoardBuilder } from '../../../src/rules/board-builder.js';
import { movesEqual } from '../../../src/rules/move-generator.js';
import { createInitialPosition } from '../../../src/rules/position.js';
import { ukrainianRules } from '../../../src/rules/variants/index.js';
import { evaluatePosition } from '../../../src/search/evaluation.js';
import { MinimaxBot, plainMinimaxSearch } from '../../../src/search/minimax-bot.js';
import { RandomBot } from '../../../src/search/random-bot.js';
import { TranspositionTable } from '../../../src/search/transposition-table.js';

const sq = (coord: string) => parseSquareAlgebraic(coord, 8);

describe('Search layer: Evaluation, RandomBot, MinimaxBot, and TranspositionTable', () => {
  it('RandomBot always selects a move belonging to legalMoves()', () => {
    const bot = new RandomBot(42);
    let pos = createInitialPosition(ukrainianRules);

    for (let step = 0; step < 20; step++) {
      const legal = pos.legalMoves();
      if (legal.length === 0) {
        break;
      }
      const chosen = bot.chooseMove(pos);
      expect(legal.some((m) => movesEqual(m, chosen))).toBe(true);
      pos = pos.apply(chosen);
    }
  });

  it('RandomBot is deterministic when initialized with the same seed', () => {
    const botA = new RandomBot(12345);
    const botB = new RandomBot(12345);

    let posA = createInitialPosition(ukrainianRules);
    let posB = createInitialPosition(ukrainianRules);

    for (let i = 0; i < 15; i++) {
      const moveA = botA.chooseMove(posA);
      const moveB = botB.chooseMove(posB);
      expect(moveA).toEqual(moveB);
      posA = posA.apply(moveA);
      posB = posB.apply(moveB);
    }
  });

  it('evaluates material and king advantage in favor of the stronger side', () => {
    const whiteAdvantagePos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteKing(sq('d4'), sq('e5'))
      .blackMan(sq('a7'))
      .build();

    expect(evaluatePosition(whiteAdvantagePos, 'white')).toBeGreaterThan(400);
    expect(evaluatePosition(whiteAdvantagePos, 'black')).toBeLessThan(-400);
  });

  it('MinimaxBot chooses the winning multi-capture over a single capture', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('a3'), sq('g3'))
      .blackMan(sq('b4'), sq('b6'), sq('f4'))
      .build();

    const bot = new MinimaxBot({ depth: 3 });
    const chosen = bot.chooseMove(pos);
    expect(formatMove(chosen, ukrainianRules)).toBe('a3:c5:a7');
    expect(chosen.captured).toHaveLength(2);
  });

  it('Alpha-Beta search returns the exact same evaluation score as unpruned plain Minimax while visiting fewer nodes', () => {
    const pos = new BoardBuilder(ukrainianRules)
      .turn('white')
      .whiteMan(sq('a3'), sq('c3'), sq('e3'), sq('g3'))
      .blackMan(sq('b6'), sq('d6'), sq('f6'), sq('h6'))
      .build();

    const abBot = new MinimaxBot({
      depth: 4,
      useMoveOrdering: true,
      useTranspositionTable: true,
    });

    const abResult = abBot.search(pos, 4);
    const plainResult = plainMinimaxSearch(pos, 4);

    expect(abResult.score).toBe(plainResult.score);
    expect(abResult.stats.nodesVisited).toBeLessThan(
      plainResult.stats.nodesVisited,
    );
  });

  it('TranspositionTable stores, retrieves, and respects depth replacement rules', () => {
    const tt = new TranspositionTable(500);
    const key = 0xabcdef123456n;
    const sampleMove = {
      from: 21,
      path: [17],
      captured: [],
      promotes: false,
    };

    tt.store({
      key,
      depth: 3,
      score: 120,
      flag: 'exact',
      bestMove: sampleMove,
    });

    const hit = tt.lookup(key);
    expect(hit).toBeDefined();
    expect(hit?.score).toBe(120);
    expect(hit?.depth).toBe(3);
    expect(tt.hitCount).toBe(1);

    tt.store({
      key,
      depth: 1,
      score: -50,
      flag: 'lowerbound',
      bestMove: null,
    });

    expect(tt.lookup(key)?.depth).toBe(3);
    expect(tt.lookup(key)?.score).toBe(120);
  });
});