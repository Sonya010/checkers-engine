import { ParseError } from '../errors.js';

export type PdnTokenKind =
  | 'TAG_OPEN'
  | 'TAG_CLOSE'
  | 'STRING'
  | 'COMMENT'
  | 'MOVE_NUMBER'
  | 'RESULT'
  | 'WORD';

export interface PdnToken {
  readonly kind: PdnTokenKind;
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

export function tokenizePdn(input: string): PdnToken[] {
  if (typeof input !== 'string') {
    throw new ParseError('PDN input must be a string', 1, 1, '');
  }

  const tokens: PdnToken[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;
  const len = input.length;

  while (pos < len) {
    const ch = input[pos];

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      pos++;
      column++;
      continue;
    }

    if (ch === '\n') {
      pos++;
      line++;
      column = 1;
      continue;
    }

    if (ch === '%') {
      while (pos < len && input[pos] !== '\n') {
        pos++;
        column++;
      }
      continue;
    }

    if (ch === ';') {
      const startLine = line;
      const startCol = column;
      pos++;
      column++;
      let commentText = '';
      while (pos < len && input[pos] !== '\n') {
        commentText += input[pos];
        pos++;
        column++;
      }
      tokens.push({
        kind: 'COMMENT',
        value: commentText.trim(),
        line: startLine,
        column: startCol,
      });
      continue;
    }

    if (ch === '[') {
      tokens.push({
        kind: 'TAG_OPEN',
        value: '[',
        line,
        column,
      });
      pos++;
      column++;
      continue;
    }

    if (ch === ']') {
      tokens.push({
        kind: 'TAG_CLOSE',
        value: ']',
        line,
        column,
      });
      pos++;
      column++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      throw new ParseError(
        `Nested variations ('${ch}') are not supported in PDN`,
        line,
        column,
        input,
      );
    }

    if (ch === '"') {
      const startLine = line;
      const startCol = column;
      pos++;
      column++;
      let strVal = '';
      let closed = false;

      while (pos < len) {
        const c = input[pos];
        if (c === '\\') {
          pos++;
          column++;
          if (pos >= len) {
            throw new ParseError(
              'Unterminated escape sequence in PDN string',
              startLine,
              startCol,
              input,
            );
          }
          strVal += input[pos];
          pos++;
          column++;
        } else if (c === '"') {
          pos++;
          column++;
          closed = true;
          break;
        } else if (c === '\n') {
          throw new ParseError(
            'Unterminated string literal in PDN header',
            startLine,
            startCol,
            input,
          );
        } else {
          strVal += c;
          pos++;
          column++;
        }
      }

      if (!closed) {
        throw new ParseError(
          'Unterminated string literal in PDN',
          startLine,
          startCol,
          input,
        );
      }

      tokens.push({
        kind: 'STRING',
        value: strVal,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    if (ch === '{') {
      const startLine = line;
      const startCol = column;
      pos++;
      column++;
      let commentVal = '';
      let closed = false;

      while (pos < len) {
        const c = input[pos];
        if (c === '{') {
          throw new ParseError(
            'Nested comments are not allowed in PDN',
            line,
            column,
            input,
          );
        }
        if (c === '}') {
          pos++;
          column++;
          closed = true;
          break;
        }
        if (c === '\n') {
          commentVal += c;
          pos++;
          line++;
          column = 1;
        } else {
          commentVal += c;
          pos++;
          column++;
        }
      }

      if (!closed) {
        throw new ParseError(
          'Unterminated comment block in PDN',
          startLine,
          startCol,
          input,
        );
      }

      tokens.push({
        kind: 'COMMENT',
        value: commentVal.trim(),
        line: startLine,
        column: startCol,
      });
      continue;
    }

    const startLine = line;
    const startCol = column;
    let word = '';

    while (
      pos < len &&
      input[pos] !== ' ' &&
      input[pos] !== '\t' &&
      input[pos] !== '\r' &&
      input[pos] !== '\n' &&
      input[pos] !== '[' &&
      input[pos] !== ']' &&
      input[pos] !== '{' &&
      input[pos] !== '}' &&
      input[pos] !== '"' &&
      input[pos] !== '(' &&
      input[pos] !== ')'
    ) {
      word += input[pos];
      pos++;
      column++;
    }

    if (RESULT_TOKENS.has(word)) {
      tokens.push({
        kind: 'RESULT',
        value: word,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    if (/^\d+\.+$/.test(word)) {
      tokens.push({
        kind: 'MOVE_NUMBER',
        value: word,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    const attachedMoveMatch = /^(\d+\.+)(.+)$/.exec(word);
    if (attachedMoveMatch) {
      tokens.push({
        kind: 'MOVE_NUMBER',
        value: attachedMoveMatch[1],
        line: startLine,
        column: startCol,
      });
      const rest = attachedMoveMatch[2];
      const restCol = startCol + attachedMoveMatch[1].length;
      if (RESULT_TOKENS.has(rest)) {
        tokens.push({
          kind: 'RESULT',
          value: rest,
          line: startLine,
          column: restCol,
        });
      } else {
        tokens.push({
          kind: 'WORD',
          value: rest,
          line: startLine,
          column: restCol,
        });
      }
      continue;
    }

    tokens.push({
      kind: 'WORD',
      value: word,
      line: startLine,
      column: startCol,
    });
  }

  return tokens;
}

