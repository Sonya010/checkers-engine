import { getBoardGeometry } from '../rules/board.js';
import { Rules, Square } from '../rules/types.js';
import { ParseError } from './errors.js';
import { CoordinateFormat } from './types.js';

const FILE_LETTERS = 'abcdefghij';

export function getCoordinateFormat(rules: Rules): CoordinateFormat {
  return rules.id === 'ukrainian' ? 'algebraic' : 'numeric';
}

export function formatSquareAlgebraic(
  sq: Square,
  boardSize: 8 | 10 = 8,
): string {
  const geometry = getBoardGeometry(boardSize);
  if (sq < 0 || sq >= geometry.squareCount) {
    throw new ParseError(
      `Square index ${sq} is out of range for ${boardSize}x${boardSize} board`,
      1,
      1,
      String(sq),
    );
  }
  const { row, col } = geometry.coords[sq];
  const file = FILE_LETTERS[col];
  const rank = boardSize - row;
  return `${file}${rank}`;
}

export function formatSquareNumeric(
  sq: Square,
  boardSize: 8 | 10 = 8,
): string {
  const geometry = getBoardGeometry(boardSize);
  if (sq < 0 || sq >= geometry.squareCount) {
    throw new ParseError(
      `Square index ${sq} is out of range for ${boardSize}x${boardSize} board`,
      1,
      1,
      String(sq),
    );
  }
  return String(sq + 1);
}

export function formatSquare(sq: Square, rules: Rules): string {
  const fmt = getCoordinateFormat(rules);
  if (fmt === 'algebraic') {
    return formatSquareAlgebraic(sq, rules.boardSize);
  }
  return formatSquareNumeric(sq, rules.boardSize);
}

export function parseSquareAlgebraic(
  text: string,
  boardSize: 8 | 10 = 8,
  line: number = 1,
  column: number = 1,
): Square {
  const trimmed = text.trim().toLowerCase();
  const match = /^([a-j])(10|[1-9])$/.exec(trimmed);
  if (!match) {
    throw new ParseError(
      `Invalid algebraic square coordinate '${text}'`,
      line,
      column,
      text,
    );
  }

  const fileChar = match[1];
  const rankNum = Number.parseInt(match[2], 10);
  const col = FILE_LETTERS.indexOf(fileChar);

  if (col < 0 || col >= boardSize || rankNum < 1 || rankNum > boardSize) {
    throw new ParseError(
      `Square '${text}' is outside ${boardSize}x${boardSize} board`,
      line,
      column,
      text,
    );
  }

  const row = boardSize - rankNum;
  const geometry = getBoardGeometry(boardSize);
  const sq = geometry.squareFromCoords(row, col);

  if (sq === -1) {
    throw new ParseError(
      `Square '${text}' is a light square and not playable`,
      line,
      column,
      text,
    );
  }

  return sq;
}

export function parseSquareNumeric(
  text: string,
  boardSize: 8 | 10 = 8,
  line: number = 1,
  column: number = 1,
): Square {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ParseError(
      `Invalid numeric square coordinate '${text}'`,
      line,
      column,
      text,
    );
  }

  const num = Number.parseInt(trimmed, 10);
  const geometry = getBoardGeometry(boardSize);

  if (num < 1 || num > geometry.squareCount) {
    throw new ParseError(
      `Square number ${num} is out of range 1..${geometry.squareCount}`,
      line,
      column,
      text,
    );
  }

  return num - 1;
}

export function parseSquare(
  text: string,
  rules: Rules,
  line: number = 1,
  column: number = 1,
): Square {
  const trimmed = text.trim();
  if (/^[a-jA-J]/.test(trimmed)) {
    return parseSquareAlgebraic(trimmed, rules.boardSize, line, column);
  }
  if (/^\d+$/.test(trimmed)) {
    return parseSquareNumeric(trimmed, rules.boardSize, line, column);
  }
  throw new ParseError(
    `Unrecognized square format '${text}'`,
    line,
    column,
    text,
  );
}

