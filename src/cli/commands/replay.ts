import * as fs from 'node:fs';
import { formatMove, parseMove } from '../../notation/move-notation.js';
import { parsePdn, resolveRulesFromPdn } from '../../notation/pdn/parser.js';
import { Game } from '../../rules/game.js';
import { GameStatus, Position, Rules } from '../../rules/types.js';
import { renderBoard } from '../renderer.js';

export interface ReplayStep {
  readonly plyIndex: number;
  readonly moveText: string;
  readonly positionAfter: Position;
}

export interface ReplayResult {
  readonly rules: Rules;
  readonly steps: ReplayStep[];
  readonly finalStatus: GameStatus;
  readonly summaryText: string;
}

export function replayFromPdnText(
  pdnText: string,
  overrideRules?: Rules,
): ReplayResult {
  const pdn = parsePdn(pdnText);
  const rules = overrideRules ?? resolveRulesFromPdn(pdn);
  const game = new Game(rules);
  const steps: ReplayStep[] = [];
  const logLines: string[] = [];

  logLines.push(`Replaying game (${rules.id}): ${pdn.moves.length} half-moves`);

  for (let i = 0; i < pdn.moves.length; i++) {
    const rawMove = pdn.moves[i];
    const entry = pdn.moveEntries[i];
    const line = entry?.line ?? 1;
    const column = entry?.column ?? i + 1;
    const move = parseMove(rawMove, game.position, line, column);
    const formatted = formatMove(move, rules);
    game.play(move);

    steps.push({
      plyIndex: i + 1,
      moveText: formatted,
      positionAfter: game.position,
    });

    logLines.push(`Ply ${i + 1}: ${formatted}`);
  }

  logLines.push('');
  logLines.push(renderBoard(game.position));

  const finalStatus = game.status();
  if (finalStatus.kind === 'win') {
    logLines.push(`Final status: ${finalStatus.winner} wins`);
  } else if (finalStatus.kind === 'draw') {
    logLines.push(`Final status: draw (${finalStatus.reason})`);
  } else {
    logLines.push('Final status: ongoing');
  }

  return {
    rules,
    steps,
    finalStatus,
    summaryText: logLines.join('\n'),
  };
}

export function replayFromFile(
  filePath: string,
  overrideRules?: Rules,
): ReplayResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  return replayFromPdnText(content, overrideRules);
}
