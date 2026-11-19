export class ParseError extends Error {
  readonly line: number;
  readonly column: number;
  readonly input: string;

  constructor(
    message: string,
    line: number = 1,
    column: number = 1,
    input: string = '',
  ) {
    super(`${message} (at line ${line}, column ${column})`);
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
    this.input = input;
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

