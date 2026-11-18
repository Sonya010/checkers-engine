export class IllegalMoveError extends Error {
  constructor(message: string = 'Illegal move') {
    super(message);
    this.name = 'IllegalMoveError';
    Object.setPrototypeOf(this, IllegalMoveError.prototype);
  }
}

export class InvalidPositionError extends Error {
  constructor(message: string = 'Invalid position') {
    super(message);
    this.name = 'InvalidPositionError';
    Object.setPrototypeOf(this, InvalidPositionError.prototype);
  }
}

