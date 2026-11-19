import { Move, Position, Rules, Square } from '../rules/types.js';
import { formatSquare, getCoordinateFormat, parseSquare } from './coordinates.js';
import { ParseError } from './errors.js';

export function getCaptureSeparator(rules: Rules): ':' | 'x' {
  return getCoordinateFormat(rules) === 'algebraic' ? ':' : 'x';
}

export function formatMove(move: Move, rules: Rules): string {
  const allSquares = [move.from, ...move.path];
  const formattedSquares = allSquares.map((sq) => formatSquare(sq, rules));
  const separator =
    move.captured.length > 0 ? getCaptureSeparator(rules) : '-';
  return formattedSquares.join(separator);
}

export function formatMoveShort(move: Move, rules: Rules): string {
  const startSq = formatSquare(move.from, rules);
  const endSq = formatSquare(move.path[move.path.length - 1], rules);
  const separator =
    move.captured.length > 0 ? getCaptureSeparator(rules) : '-';
  return `${startSq}${separator}${endSq}`;
}

export function parseMove(
  text: string,
  position: Position,
  line: number = 1,
  column: number = 1,
): Move {
  if (typeof text !== 'string') {
    throw new ParseError('Move text must be a string', line, column, '');
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new ParseError('Empty move string', line, column, text);
  }

  const hasDash = trimmed.includes('-');
  const hasColon = trimmed.includes(':');
  const hasX = /[xX×]/.test(trimmed);

  const separatorTypesCount =
    (hasDash ? 1 : 0) + (hasColon ? 1 : 0) + (hasX ? 1 : 0);

  if (separatorTypesCount === 0) {
    throw new ParseError(
      `Missing move separator ('-', ':', or 'x') in '${trimmed}'`,
      line,
      column,
      text,
    );
  }

  if (separatorTypesCount > 1) {
    throw new ParseError(
      `Mixed move separators in '${trimmed}'`,
      line,
      column,
      text,
    );
  }

  const isCaptureNotation = hasColon || hasX;
  const parts = isCaptureNotation
    ? trimmed.split(/[:xX×]/)
    : trimmed.split('-');

  if (parts.length < 2) {
    throw new ParseError(
      `Move '${trimmed}' must contain at least origin and destination squares`,
      line,
      column,
      text,
    );
  }

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].trim().length === 0) {
      throw new ParseError(
        `Malformed move '${trimmed}' with empty square segment`,
        line,
        column,
        text,
      );
    }
  }

  if (!isCaptureNotation && parts.length !== 2) {
    throw new ParseError(
      `Quiet move '${trimmed}' must have exactly 2 squares`,
      line,
      column,
      text,
    );
  }

  const squares: Square[] = parts.map((part) =>
    parseSquare(part, position.rules, line, column),
  );

  const fromSq = squares[0];
  const pathSquares = squares.slice(1);
  const legalMoves = position.legalMoves();

  if (!isCaptureNotation) {
    const targetSq = pathSquares[0];
    for (let i = 0; i < legalMoves.length; i++) {
      const m = legalMoves[i];
      if (
        m.captured.length === 0 &&
        m.from === fromSq &&
        m.path.length === 1 &&
        m.path[0] === targetSq
      ) {
        return m;
      }
    }
    throw new ParseError(
      `Quiet move '${trimmed}' is not legal in the current position`,
      line,
      column,
      text,
    );
  }

  const exactMatches: Move[] = [];
  for (let i = 0; i < legalMoves.length; i++) {
    const m = legalMoves[i];
    if (
      m.captured.length > 0 &&
      m.from === fromSq &&
      arraysMatch(m.path, pathSquares)
    ) {
      exactMatches.push(m);
    }
  }

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    throw new ParseError(
      `Ambiguous capture move '${trimmed}' matches multiple legal paths`,
      line,
      column,
      text,
    );
  }

  if (pathSquares.length === 1) {
    const endSq = pathSquares[0];
    const endpointMatches = legalMoves.filter(
      (m) =>
        m.captured.length > 0 &&
        m.from === fromSq &&
        m.path[m.path.length - 1] === endSq,
    );

    if (endpointMatches.length === 1) {
      return endpointMatches[0];
    }
    if (endpointMatches.length > 1) {
      throw new ParseError(
        `Shorthand capture '${trimmed}' is ambiguous (${endpointMatches.length} possible paths)`,
        line,
        column,
        text,
      );
    }
  }

  throw new ParseError(
    `Capture move '${trimmed}' is not legal in the current position`,
    line,
    column,
    text,
  );
}

function arraysMatch(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

