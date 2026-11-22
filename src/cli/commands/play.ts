import * as readline from 'node:readline';
import { formatMove, parseMove } from '../../notation/move-notation.js';
import { Game } from '../../rules/game.js';
import { Rules } from '../../rules/types.js';
import { Bot } from '../../search/types.js';
import { renderPositionSummary } from '../renderer.js';
import { createBotFromSpec } from './botmatch.js';

export interface PlaySessionOptions {
  readonly rules: Rules;
  readonly whiteSpec: string;
  readonly blackSpec: string;
  readonly seed?: number;
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
}

export async function runPlaySession(
  options: PlaySessionOptions,
): Promise<Game> {
  const seed = options.seed ?? 1;
  const whiteBot: Bot | null =
    options.whiteSpec.toLowerCase() === 'human'
      ? null
      : createBotFromSpec(options.whiteSpec, seed);
  const blackBot: Bot | null =
    options.blackSpec.toLowerCase() === 'human'
      ? null
      : createBotFromSpec(options.blackSpec, seed + 1000);

  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const rl = readline.createInterface({ input, output, terminal: false });

  const lineQueue: string[] = [];
  let streamClosed = false;
  let pendingResolve: ((line: string | null) => void) | null = null;

  rl.on('line', (line) => {
    if (pendingResolve !== null) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(line);
    } else {
      lineQueue.push(line);
    }
  });

  rl.on('close', () => {
    streamClosed = true;
    if (pendingResolve !== null) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(null);
    }
  });

  const askLine = (promptText: string): Promise<string | null> => {
    output.write(promptText);
    if (lineQueue.length > 0) {
      const next = lineQueue.shift()!;
      return Promise.resolve(next);
    }
    if (streamClosed) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  };

  const game = new Game(options.rules);

  try {
    while (game.status().kind === 'ongoing') {
      output.write('\n' + renderPositionSummary(game.position) + '\n');
      const activeBot = game.position.turn === 'white' ? whiteBot : blackBot;

      if (activeBot !== null) {
        const move = activeBot.chooseMove(game.position);
        const formatted = formatMove(move, options.rules);
        output.write(`Bot (${game.position.turn}) plays: ${formatted}\n`);
        game.play(move);
      } else {
        const line = await askLine(
          `Enter move for ${game.position.turn} (or 'quit'): `,
        );
        if (line === null || line.trim().toLowerCase() === 'quit') {
          output.write('Exiting game.\n');
          break;
        }
        try {
          const move = parseMove(line.trim(), game.position);
          game.play(move);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          output.write(`Invalid move: ${msg}\n`);
        }
      }
    }

    output.write('\n' + renderPositionSummary(game.position) + '\n');
  } finally {
    rl.close();
  }

  return game;
}
