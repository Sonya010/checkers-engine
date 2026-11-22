import { getRulesById } from '../rules/variants/index.js';
import { runBotMatch } from './commands/botmatch.js';
import { runPlaySession } from './commands/play.js';
import { replayFromFile } from './commands/replay.js';
import { renderBoard } from './renderer.js';

export interface ParsedCliArgs {
  readonly command: string;
  readonly rulesId: string;
  readonly explicitRulesId?: string;
  readonly white: string;
  readonly black: string;
  readonly seed: number;
  readonly filePath?: string;
}

export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const command = argv[0] ?? 'help';
  let rulesId = 'ukrainian';
  let explicitRulesId: string | undefined;
  let white = 'human';
  let black = 'minimax:4';
  let seed = 1;
  let filePath: string | undefined;

  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--rules' && i + 1 < argv.length) {
      rulesId = argv[i + 1];
      explicitRulesId = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--white' && i + 1 < argv.length) {
      white = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--black' && i + 1 < argv.length) {
      black = argv[i + 1];
      i += 2;
      continue;
    }
    if (arg === '--seed' && i + 1 < argv.length) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(parsed)) {
        seed = parsed;
      }
      i += 2;
      continue;
    }
    if (!arg.startsWith('--') && filePath === undefined) {
      filePath = arg;
    }
    i++;
  }

  if (command === 'botmatch' && white === 'human') {
    white = 'minimax:4';
  }

  return {
    command,
    rulesId,
    explicitRulesId,
    white,
    black,
    seed,
    filePath,
  };
}

export async function runCli(argv: readonly string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);

    if (parsed.command === 'help' || parsed.command === '--help') {
      process.stdout.write(
        [
          'Usage:',
          '  play --rules <ukrainian|english> --white <human|random|minimax:N> --black <human|random|minimax:N>',
          '  botmatch --rules <ukrainian|english> --white <bot> --black <bot> --seed <N>',
          '  replay <pdn-file> [--rules <ukrainian|english>]',
        ].join('\n') + '\n',
      );
      return 0;
    }

    if (parsed.command === 'botmatch') {
      const rules = getRulesById(parsed.rulesId);
      const result = runBotMatch({
        rules,
        whiteSpec: parsed.white,
        blackSpec: parsed.black,
        seed: parsed.seed,
      });

      process.stdout.write(renderBoard(result.game.position) + '\n');
      process.stdout.write(
        `Moves played: ${result.moveList.length}\nStatus: ${JSON.stringify(result.status)}\n\n${result.pdn}`,
      );
      return 0;
    }

    if (parsed.command === 'replay') {
      if (!parsed.filePath) {
        process.stderr.write('Error: Missing file path for replay command\n');
        return 1;
      }
      const overrideRules = parsed.explicitRulesId
        ? getRulesById(parsed.explicitRulesId)
        : undefined;
      const result = replayFromFile(parsed.filePath, overrideRules);
      process.stdout.write(result.summaryText + '\n');
      return 0;
    }

    if (parsed.command === 'play') {
      const rules = getRulesById(parsed.rulesId);
      await runPlaySession({
        rules,
        whiteSpec: parsed.white,
        blackSpec: parsed.black,
        seed: parsed.seed,
      });
      return 0;
    }

    process.stderr.write(`Unknown command '${parsed.command}'\n`);
    return 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${msg}\n`);
    return 1;
  }
}

const normalizedArgv1 =
  typeof process !== 'undefined' && process.argv[1]
    ? process.argv[1].replace(/\\/g, '/')
    : '';

const isMainModule =
  normalizedArgv1.endsWith('/cli/index.ts') ||
  normalizedArgv1.endsWith('/cli/index.js');

if (isMainModule) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
