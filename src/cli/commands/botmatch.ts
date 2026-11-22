import { formatMove } from '../../notation/move-notation.js';
import { formatGameAsPdn } from '../../notation/pdn/formatter.js';
import { Game } from '../../rules/game.js';
import { GameStatus, Rules } from '../../rules/types.js';
import { MinimaxBot } from '../../search/minimax-bot.js';
import { RandomBot } from '../../search/random-bot.js';
import { Bot } from '../../search/types.js';

export interface BotMatchOptions {
  readonly rules: Rules;
  readonly whiteSpec: string;
  readonly blackSpec: string;
  readonly seed?: number;
  readonly maxPlies?: number;
}

export interface BotMatchResult {
  readonly game: Game;
  readonly status: GameStatus;
  readonly moveList: string[];
  readonly pdn: string;
}

export function createBotFromSpec(spec: string, seed: number = 1): Bot {
  const normalized = spec.trim().toLowerCase();
  if (normalized === 'random' || normalized.startsWith('random:')) {
    const parts = normalized.split(':');
    const customSeed = parts[1] ? Number.parseInt(parts[1], 10) : seed;
    return new RandomBot(Number.isNaN(customSeed) ? seed : customSeed);
  }

  if (normalized === 'minimax' || normalized.startsWith('minimax:')) {
    const parts = normalized.split(':');
    const depth = parts[1] ? Number.parseInt(parts[1], 10) : 4;
    return new MinimaxBot({
      depth: Number.isNaN(depth) ? 4 : depth,
    });
  }

  throw new Error(`Unknown bot specification '${spec}'`);
}

export function runBotMatch(options: BotMatchOptions): BotMatchResult {
  const seed = options.seed ?? 1;
  const maxPlies = options.maxPlies ?? 300;
  const whiteBot = createBotFromSpec(options.whiteSpec, seed);
  const blackBot = createBotFromSpec(options.blackSpec, seed + 1000);

  const game = new Game(options.rules);
  const moveList: string[] = [];
  let plies = 0;

  while (game.status().kind === 'ongoing' && plies < maxPlies) {
    const activeBot = game.position.turn === 'white' ? whiteBot : blackBot;
    const chosenMove = activeBot.chooseMove(game.position);
    const formatted = formatMove(chosenMove, options.rules);
    game.play(chosenMove);
    moveList.push(formatted);
    plies++;
  }

  let finalStatus = game.status();
  if (finalStatus.kind === 'ongoing' && plies >= maxPlies) {
    finalStatus = {
      kind: 'draw',
      reason: 'max-plies-exceeded',
    };
  }

  const pdn = formatGameAsPdn(game, {
    Event: 'Bot Match',
    White: options.whiteSpec,
    Black: options.blackSpec,
    Rules: options.rules.id,
  });

  return {
    game,
    status: finalStatus,
    moveList,
    pdn,
  };
}

