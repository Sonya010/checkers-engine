import { getBoardGeometry } from './board.js';
import { IllegalMoveError, InvalidPositionError } from './errors.js';
import { MoveGenerator, movesEqual } from './move-generator.js';
import {
  Color,
  GameStatus,
  MaterialCount,
  Move,
  Piece,
  Position,
  Rules,
  Square,
} from './types.js';
import { computePositionKey, defaultZobristTable } from './zobrist.js';

export function oppositeColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export interface CustomPositionOptions {
  readonly rules: Rules;
  readonly pieces: ReadonlyMap<Square, Piece> | readonly (Piece | null)[];
  readonly turn?: Color;
  readonly kingOnlyHalfMoves?: number;
  readonly endgameHalfMoves?: number;
}

export class PositionImpl implements Position {
  readonly rules: Rules;
  readonly turn: Color;
  readonly key: bigint;
  readonly kingOnlyHalfMoves: number;
  readonly endgameHalfMoves: number;

  private readonly pieces: readonly (Piece | null)[];
  private readonly generator: MoveGenerator;
  private cachedLegalMoves: Move[] | null = null;
  private cachedStatus: GameStatus | null = null;
  private cachedMaterial: MaterialCount | null = null;

  constructor(
    rules: Rules,
    pieces: readonly (Piece | null)[],
    turn: Color,
    kingOnlyHalfMoves: number = 0,
    endgameHalfMoves: number = 0,
    key?: bigint,
    generator?: MoveGenerator,
  ) {
    const geometry = getBoardGeometry(rules.boardSize);
    if (pieces.length !== geometry.squareCount) {
      throw new InvalidPositionError(
        `Expected ${geometry.squareCount} squares for board size ${rules.boardSize}, got ${pieces.length}`,
      );
    }

    this.rules = rules;
    this.pieces = Object.freeze([...pieces]);
    this.turn = turn;
    this.kingOnlyHalfMoves = kingOnlyHalfMoves;
    this.endgameHalfMoves = endgameHalfMoves;
    this.key = key ?? computePositionKey(this.pieces, turn, defaultZobristTable);
    this.generator = generator ?? new MoveGenerator(rules);
  }

  pieceAt(sq: Square): Piece | null {
    if (sq < 0 || sq >= this.pieces.length) {
      return null;
    }
    const p = this.pieces[sq];
    return p ? { color: p.color, kind: p.kind } : null;
  }

  squareCount(): number {
    return this.pieces.length;
  }

  material(): MaterialCount {
    if (this.cachedMaterial !== null) {
      return this.cachedMaterial;
    }
    let whiteMen = 0;
    let whiteKings = 0;
    let blackMen = 0;
    let blackKings = 0;

    for (let sq = 0; sq < this.pieces.length; sq++) {
      const p = this.pieces[sq];
      if (p === null) {
        continue;
      }
      if (p.color === 'white') {
        if (p.kind === 'man') {
          whiteMen++;
        } else {
          whiteKings++;
        }
      } else {
        if (p.kind === 'man') {
          blackMen++;
        } else {
          blackKings++;
        }
      }
    }

    this.cachedMaterial = Object.freeze({
      whiteMen,
      whiteKings,
      blackMen,
      blackKings,
      whiteTotal: whiteMen + whiteKings,
      blackTotal: blackMen + blackKings,
    });
    return this.cachedMaterial;
  }

  countPieces(color?: Color, kind?: 'man' | 'king'): number {
    let count = 0;
    for (let sq = 0; sq < this.pieces.length; sq++) {
      const p = this.pieces[sq];
      if (p !== null) {
        if (
          (color === undefined || p.color === color) &&
          (kind === undefined || p.kind === kind)
        ) {
          count++;
        }
      }
    }
    return count;
  }

  legalMoves(): Move[] {
    if (this.cachedLegalMoves === null) {
      if (this.checkDrawReason() !== null) {
        this.cachedLegalMoves = [];
      } else {
        this.cachedLegalMoves = this.generator.generateLegalMoves(
          this.pieces,
          this.turn,
        );
      }
    }
    return this.cachedLegalMoves.map((m) => ({
      from: m.from,
      path: [...m.path],
      captured: [...m.captured],
      promotes: m.promotes,
    }));
  }

  apply(move: Move): Position {
    const legal = this.legalMoves();
    let matchedMove: Move | null = null;

    for (let i = 0; i < legal.length; i++) {
      if (movesEqual(legal[i], move)) {
        matchedMove = legal[i];
        break;
      }
    }

    if (matchedMove === null) {
      throw new IllegalMoveError(
        `Move from ${move.from} via [${move.path.join(', ')}] is not legal in current position`,
      );
    }

    const movingPiece = this.pieces[matchedMove.from];
    if (movingPiece === null) {
      throw new IllegalMoveError(`No piece at origin square ${matchedMove.from}`);
    }

    const nextPieces: (Piece | null)[] = [...this.pieces];
    let nextKey = this.key;

    nextPieces[matchedMove.from] = null;
    nextKey ^= defaultZobristTable.getPieceKey(matchedMove.from, movingPiece);

    for (let c = 0; c < matchedMove.captured.length; c++) {
      const capSq = matchedMove.captured[c];
      const capPiece = nextPieces[capSq];
      if (capPiece !== null) {
        nextKey ^= defaultZobristTable.getPieceKey(capSq, capPiece);
        nextPieces[capSq] = null;
      }
    }

    const finalSq = matchedMove.path[matchedMove.path.length - 1];
    const landedPiece: Piece = {
      color: movingPiece.color,
      kind: matchedMove.promotes ? 'king' : movingPiece.kind,
    };

    nextPieces[finalSq] = landedPiece;
    nextKey ^= defaultZobristTable.getPieceKey(finalSq, landedPiece);

    const nextTurn = oppositeColor(this.turn);
    nextKey ^= defaultZobristTable.blackTurnKey;

    const isKingMoveOnly =
      movingPiece.kind === 'king' &&
      matchedMove.captured.length === 0 &&
      !matchedMove.promotes;

    const nextKingOnlyHalfMoves = isKingMoveOnly
      ? this.kingOnlyHalfMoves + 1
      : 0;

    const wasEndgame = this.getEndgamePliesLimit() !== null;
    const nextEndgameHalfMoves =
      wasEndgame && matchedMove.captured.length === 0 && !matchedMove.promotes
        ? this.endgameHalfMoves + 1
        : 0;

    return new PositionImpl(
      this.rules,
      nextPieces,
      nextTurn,
      nextKingOnlyHalfMoves,
      nextEndgameHalfMoves,
      nextKey,
      this.generator,
    );
  }

  status(): GameStatus {
    if (this.cachedStatus !== null) {
      return this.cachedStatus;
    }

    const drawReason = this.checkDrawReason();
    if (drawReason !== null) {
      this.cachedStatus = {
        kind: 'draw',
        reason: drawReason,
      };
      return this.cachedStatus;
    }

    const moves = this.generator.generateLegalMoves(this.pieces, this.turn);
    if (moves.length === 0) {
      this.cachedStatus = {
        kind: 'win',
        winner: oppositeColor(this.turn),
      };
      return this.cachedStatus;
    }

    this.cachedStatus = { kind: 'ongoing' };
    return this.cachedStatus;
  }

  private checkDrawReason(): string | null {
    const limitPlies = this.rules.draw.kingMovesWithoutCaptureLimit * 2;
    if (this.kingOnlyHalfMoves >= limitPlies) {
      return 'king-moves-limit';
    }

    const endgameLimitPlies = this.getEndgamePliesLimit();
    if (endgameLimitPlies !== null && this.endgameHalfMoves >= endgameLimitPlies) {
      return 'endgame-limit';
    }

    return null;
  }

  private getEndgamePliesLimit(): number | null {
    const endgame = this.rules.draw.endgame;
    if (!endgame || !endgame.enabled) {
      return null;
    }

    const mat = this.material();
    const whiteIsLoneKing = mat.whiteKings === 1 && mat.whiteMen === 0;
    const blackIsLoneKing = mat.blackKings === 1 && mat.blackMen === 0;

    if (whiteIsLoneKing && blackIsLoneKing) {
      return endgame.singleKingVsOneKingLimit * 2;
    }

    if (whiteIsLoneKing && mat.blackKings >= 1 && mat.blackTotal <= 2) {
      return endgame.singleKingVsTwoOrFewerLimit * 2;
    }

    if (blackIsLoneKing && mat.whiteKings >= 1 && mat.whiteTotal <= 2) {
      return endgame.singleKingVsTwoOrFewerLimit * 2;
    }

    if (endgame.singleKingVsThreeLimit !== undefined) {
      if (whiteIsLoneKing && mat.blackKings >= 1 && mat.blackTotal === 3) {
        return endgame.singleKingVsThreeLimit * 2;
      }
      if (blackIsLoneKing && mat.whiteKings >= 1 && mat.whiteTotal === 3) {
        return endgame.singleKingVsThreeLimit * 2;
      }
    }

    return null;
  }
}

export function createInitialPosition(rules: Rules): Position {
  const geometry = getBoardGeometry(rules.boardSize);
  const pieces: (Piece | null)[] = Array.from(
    { length: geometry.squareCount },
    () => null,
  );

  for (let sq = 0; sq < geometry.piecesPerPlayer; sq++) {
    pieces[sq] = { color: 'black', kind: 'man' };
  }

  for (
    let sq = geometry.squareCount - geometry.piecesPerPlayer;
    sq < geometry.squareCount;
    sq++
  ) {
    pieces[sq] = { color: 'white', kind: 'man' };
  }

  return new PositionImpl(rules, pieces, rules.firstMover, 0, 0);
}

export function createCustomPosition(options: CustomPositionOptions): Position {
  const geometry = getBoardGeometry(options.rules.boardSize);
  const piecesArr: (Piece | null)[] = Array.from(
    { length: geometry.squareCount },
    () => null,
  );

  if (Array.isArray(options.pieces)) {
    if (options.pieces.length !== geometry.squareCount) {
      throw new InvalidPositionError(
        `Custom pieces array length ${options.pieces.length} does not match ${geometry.squareCount}`,
      );
    }
    for (let i = 0; i < geometry.squareCount; i++) {
      const p = options.pieces[i];
      piecesArr[i] = p ? { color: p.color, kind: p.kind } : null;
    }
  } else {
    const pieceMap = options.pieces as ReadonlyMap<Square, Piece>;
    for (const [sq, piece] of pieceMap.entries()) {
      if (sq < 0 || sq >= geometry.squareCount) {
        throw new InvalidPositionError(`Square index ${sq} is out of bounds`);
      }
      piecesArr[sq] = { color: piece.color, kind: piece.kind };
    }
  }

  return new PositionImpl(
    options.rules,
    piecesArr,
    options.turn ?? options.rules.firstMover,
    options.kingOnlyHalfMoves ?? 0,
    options.endgameHalfMoves ?? 0,
  );
}
