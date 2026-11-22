import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runBotMatch } from '../../src/cli/commands/botmatch.js';
import { runPlaySession } from '../../src/cli/commands/play.js';
import { replayFromPdnText } from '../../src/cli/commands/replay.js';
import { ParseError } from '../../src/notation/errors.js';
import { createInitialPosition } from '../../src/rules/position.js';
import { Position } from '../../src/rules/types.js';
import {
  englishRules,
  ukrainianRules,
} from '../../src/rules/variants/index.js';

function countPerftNodes(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }
  const moves = position.legalMoves();
  let total = 0;
  for (let i = 0; i < moves.length; i++) {
    total += countPerftNodes(position.apply(moves[i]), depth - 1);
  }
  return total;
}

describe('End-to-End (E2E) full game, CLI session, Perft, and PDN replay scenarios', () => {
  it('completes a full RandomBot vs RandomBot game and replays its generated PDN', () => {
    const match = runBotMatch({
      rules: ukrainianRules,
      whiteSpec: 'random:7',
      blackSpec: 'random:13',
      seed: 7,
      maxPlies: 250,
    });

    expect(match.moveList.length).toBeGreaterThan(0);
    expect(['win', 'draw']).toContain(match.status.kind);

    const replayed = replayFromPdnText(match.pdn);
    expect(replayed.steps).toHaveLength(match.moveList.length);
  });

  it('MinimaxBot defeats RandomBot in a full Ukrainian rules match', () => {
    const match = runBotMatch({
      rules: ukrainianRules,
      whiteSpec: 'minimax:3',
      blackSpec: 'random:101',
      seed: 101,
      maxPlies: 200,
    });

    expect(match.status).toEqual({
      kind: 'win',
      winner: 'white',
    });
  });

  it('auto-detects English rules from PDN header and reports exact line and column on illegal move', () => {
    const validEnglishPdn = [
      '[Event "English Check"]',
      '[Rules "english"]',
      '',
      '1. 11-15 23-19 2. 8-11 22-17 *',
    ].join('\n');

    const replayed = replayFromPdnText(validEnglishPdn);
    expect(replayed.rules.id).toBe('english');
    expect(replayed.steps).toHaveLength(4);

    const invalidPdn = [
      '[Event "Invalid Replay"]',
      '[Rules "english"]',
      '',
      '1. 11-15 23-18',
      '2. 15-16 *',
    ].join('\n');

    expect(() => replayFromPdnText(invalidPdn)).toThrow(ParseError);
    try {
      replayFromPdnText(invalidPdn);
    } catch (err) {
      const parseErr = err as ParseError;
      expect(parseErr.line).toBe(5);
      expect(parseErr.column).toBe(4);
    }
  });

  it('processes piped multi-line stdin in runPlaySession without dropping buffered lines', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let capturedOutput = '';
    output.on('data', (chunk) => {
      capturedOutput += chunk.toString();
    });

    input.end('c3-d4\ninvalid-move\nb6-a5\nd4-c5\nquit\n');

    const game = await runPlaySession({
      rules: ukrainianRules,
      whiteSpec: 'human',
      blackSpec: 'human',
      input,
      output,
    });

    expect(game.moves.length).toBe(3);
    expect(capturedOutput).toContain('Invalid move:');
    expect(capturedOutput).toContain('Exiting game.');
  });

  it('matches reference Perft node counts for English and Ukrainian draughts up to depth 5', () => {
    const enStart = createInitialPosition(englishRules);
    expect(countPerftNodes(enStart, 1)).toBe(7);
    expect(countPerftNodes(enStart, 2)).toBe(49);
    expect(countPerftNodes(enStart, 3)).toBe(302);
    expect(countPerftNodes(enStart, 4)).toBe(1469);
    expect(countPerftNodes(enStart, 5)).toBe(7361);

    const uaStart = createInitialPosition(ukrainianRules);
    expect(countPerftNodes(uaStart, 1)).toBe(7);
    expect(countPerftNodes(uaStart, 2)).toBe(49);
    expect(countPerftNodes(uaStart, 3)).toBe(302);
    expect(countPerftNodes(uaStart, 4)).toBe(1469);
    expect(countPerftNodes(uaStart, 5)).toBe(7482);
  });
});
