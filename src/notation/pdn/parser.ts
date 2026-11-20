import { Game } from '../../rules/game.js';
import { Move, Rules } from '../../rules/types.js';
import {
  englishRules,
  getRulesById,
  ukrainianRules,
} from '../../rules/variants/index.js';
import { ParseError } from '../errors.js';
import { parseMove } from '../move-notation.js';
import { PdnGame, PdnMoveEntry, PdnResult, ReplayedPdnGame } from '../types.js';
import { PdnToken, tokenizePdn } from './tokenizer.js';

const MOVE_SYNTAX_REGEX =
  /^([a-jA-J](?:10|[1-9])|\d+)(?:[-:xX×]([a-jA-J](?:10|[1-9])|\d+))+$/;

export function parsePdn(text: string): PdnGame {
  const tokens = tokenizePdn(text);
  if (tokens.length === 0) {
    throw new ParseError('Empty PDN input', 1, 1, text);
  }

  let idx = 0;
  const headers: Record<string, string> = {};

  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (tok.kind === 'COMMENT' && Object.keys(headers).length === 0) {
      idx++;
      continue;
    }

    if (tok.kind !== 'TAG_OPEN') {
      break;
    }

    const openTok = tok;
    idx++;

    if (idx >= tokens.length || tokens[idx].kind !== 'WORD') {
      const errTok = tokens[idx] ?? openTok;
      throw new ParseError(
        'Expected header tag name after "["',
        errTok.line,
        errTok.column,
        text,
      );
    }

    const tagNameTok = tokens[idx];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tagNameTok.value)) {
      throw new ParseError(
        `Invalid PDN tag name '${tagNameTok.value}'`,
        tagNameTok.line,
        tagNameTok.column,
        text,
      );
    }
    idx++;

    if (idx >= tokens.length || tokens[idx].kind !== 'STRING') {
      const errTok = tokens[idx] ?? tagNameTok;
      throw new ParseError(
        `Expected quoted string value for tag '${tagNameTok.value}'`,
        errTok.line,
        errTok.column,
        text,
      );
    }

    const tagValueTok = tokens[idx];
    idx++;

    if (idx >= tokens.length || tokens[idx].kind !== 'TAG_CLOSE') {
      const errTok = tokens[idx] ?? tagValueTok;
      throw new ParseError(
        `Expected closing "]" for tag '${tagNameTok.value}'`,
        errTok.line,
        errTok.column,
        text,
      );
    }

    idx++;
    headers[tagNameTok.value] = tagValueTok.value;
  }

  const moves: string[] = [];
  const moveEntries: PdnMoveEntry[] = [];
  let result: PdnResult | null = null;
  let pendingMoveNumber: number | undefined = undefined;

  while (idx < tokens.length) {
    const tok: PdnToken = tokens[idx];

    if (tok.kind === 'COMMENT') {
      if (moveEntries.length > 0) {
        const prev = moveEntries[moveEntries.length - 1];
        moveEntries[moveEntries.length - 1] = {
          ...prev,
          comment: prev.comment ? `${prev.comment} ${tok.value}` : tok.value,
        };
      }
      idx++;
      continue;
    }

    if (tok.kind === 'MOVE_NUMBER') {
      if (result !== null) {
        throw new ParseError(
          `Unexpected move number '${tok.value}' after game result`,
          tok.line,
          tok.column,
          text,
        );
      }
      const numVal = Number.parseInt(tok.value, 10);
      pendingMoveNumber = Number.isNaN(numVal) ? undefined : numVal;
      idx++;
      continue;
    }

    if (tok.kind === 'RESULT') {
      if (result !== null) {
        throw new ParseError(
          `Duplicate game result token '${tok.value}'`,
          tok.line,
          tok.column,
          text,
        );
      }
      result = tok.value as PdnResult;
      idx++;
      continue;
    }

    if (tok.kind === 'TAG_OPEN' || tok.kind === 'TAG_CLOSE' || tok.kind === 'STRING') {
      throw new ParseError(
        `Unexpected header token '${tok.value}' in move section`,
        tok.line,
        tok.column,
        text,
      );
    }

    if (tok.kind === 'WORD') {
      if (result !== null) {
        throw new ParseError(
          `Unexpected move '${tok.value}' after game result '${result}'`,
          tok.line,
          tok.column,
          text,
        );
      }

      if (!MOVE_SYNTAX_REGEX.test(tok.value)) {
        throw new ParseError(
          `Invalid move token '${tok.value}' in PDN`,
          tok.line,
          tok.column,
          text,
        );
      }

      moves.push(tok.value);
      moveEntries.push({
        moveNumber: pendingMoveNumber,
        text: tok.value,
        line: tok.line,
        column: tok.column,
      });
      pendingMoveNumber = undefined;
      idx++;
      continue;
    }
  }

  const headerResult = headers.Result;
  if (result === null) {
    if (
      headerResult === '1-0' ||
      headerResult === '0-1' ||
      headerResult === '1/2-1/2' ||
      headerResult === '*'
    ) {
      result = headerResult;
    } else {
      result = '*';
    }
  }

  return {
    headers,
    moves,
    moveEntries,
    result,
  };
}

export function resolveRulesFromPdn(
  pdn: PdnGame,
  fallbackRules: Rules = ukrainianRules,
): Rules {
  const variantHeader =
    pdn.headers.Rules ?? pdn.headers.Variant ?? pdn.headers.GameType;

  if (!variantHeader) {
    if (pdn.moves.length > 0 && /^\d/.test(pdn.moves[0])) {
      return englishRules;
    }
    return fallbackRules;
  }

  const normalized = variantHeader.trim().toLowerCase();
  if (
    normalized === 'ukrainian' ||
    normalized === '25' ||
    normalized.startsWith('25,')
  ) {
    return ukrainianRules;
  }
  if (
    normalized === 'english' ||
    normalized === '21' ||
    normalized.startsWith('21,')
  ) {
    return englishRules;
  }

  try {
    return getRulesById(normalized);
  } catch {
    return fallbackRules;
  }
}

export function replayPdn(
  pdnOrText: PdnGame | string,
  overrideRules?: Rules,
): ReplayedPdnGame {
  const pdn = typeof pdnOrText === 'string' ? parsePdn(pdnOrText) : pdnOrText;
  const rules = overrideRules ?? resolveRulesFromPdn(pdn);
  const game = new Game(rules);
  const appliedMoves: Move[] = [];

  for (let i = 0; i < pdn.moves.length; i++) {
    const moveText = pdn.moves[i];
    const entry = pdn.moveEntries[i];
    const line = entry?.line ?? 1;
    const column = entry?.column ?? i + 1;
    const move = parseMove(moveText, game.position, line, column);
    game.play(move);
    appliedMoves.push(move);
  }

  return {
    pdn,
    rules,
    appliedMoves,
  };
}
