import { Game } from '../../rules/game.js';
import { GameStatus } from '../../rules/types.js';
import { formatMove } from '../move-notation.js';
import { PdnGame, PdnMoveEntry, PdnResult } from '../types.js';

const STANDARD_HEADER_ORDER = [
  'Event',
  'Site',
  'Date',
  'Round',
  'White',
  'Black',
  'Result',
  'GameType',
  'Rules',
];

export function statusToPdnResult(status: GameStatus): PdnResult {
  if (status.kind === 'win') {
    return status.winner === 'white' ? '1-0' : '0-1';
  }
  if (status.kind === 'draw') {
    return '1/2-1/2';
  }
  return '*';
}

export function formatPdn(game: PdnGame): string {
  const lines: string[] = [];
  const headerKeys = Object.keys(game.headers);

  const orderedKeys: string[] = [];
  for (const stdKey of STANDARD_HEADER_ORDER) {
    if (headerKeys.includes(stdKey)) {
      orderedKeys.push(stdKey);
    }
  }
  for (const key of headerKeys) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  for (const key of orderedKeys) {
    const val = game.headers[key].replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`[${key} "${val}"]`);
  }

  if (lines.length > 0) {
    lines.push('');
  }

  const moveTokens: string[] = [];
  const entries: readonly PdnMoveEntry[] =
    game.moveEntries && game.moveEntries.length === game.moves.length
      ? game.moveEntries
      : game.moves.map((m) => ({ text: m }));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (i % 2 === 0) {
      const moveNum = entry.moveNumber ?? Math.floor(i / 2) + 1;
      moveTokens.push(`${moveNum}.`);
    }
    moveTokens.push(entry.text);
    if (entry.comment && entry.comment.trim().length > 0) {
      moveTokens.push(`{${entry.comment.trim()}}`);
    }
  }

  const resultToken: PdnResult = game.result ?? '*';
  moveTokens.push(resultToken);

  const wrappedMoves = wrapTokensToLines(moveTokens, 80);
  for (const moveLine of wrappedMoves) {
    lines.push(moveLine);
  }

  return lines.join('\n').trim() + '\n';
}

function wrapTokensToLines(tokens: readonly string[], maxLen: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (currentLine.length === 0) {
      currentLine = tok;
    } else if (currentLine.length + 1 + tok.length <= maxLen) {
      currentLine += ` ${tok}`;
    } else {
      lines.push(currentLine);
      currentLine = tok;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

export function gameToPdn(
  game: Game,
  extraHeaders: Record<string, string> = {},
): PdnGame {
  const status = game.status();
  const result = statusToPdnResult(status);
  const rules = game.rules;

  const headers: Record<string, string> = {
    Event: extraHeaders.Event ?? 'Checkers Game',
    White: extraHeaders.White ?? 'White',
    Black: extraHeaders.Black ?? 'Black',
    Rules: extraHeaders.Rules ?? rules.id,
    Result: extraHeaders.Result ?? result,
    ...extraHeaders,
  };

  const moves: string[] = [];
  const moveEntries: PdnMoveEntry[] = [];

  for (let i = 0; i < game.entries.length; i++) {
    const entry = game.entries[i];
    const formatted = formatMove(entry.move, rules);
    moves.push(formatted);
    moveEntries.push({
      moveNumber: i % 2 === 0 ? Math.floor(i / 2) + 1 : undefined,
      text: formatted,
    });
  }

  return {
    headers,
    moves,
    moveEntries,
    result,
  };
}

export function formatGameAsPdn(
  game: Game,
  extraHeaders: Record<string, string> = {},
): string {
  return formatPdn(gameToPdn(game, extraHeaders));
}

