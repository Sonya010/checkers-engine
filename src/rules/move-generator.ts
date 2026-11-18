import { ALL_DIRECTIONS, BoardGeometry, getBoardGeometry } from './board.js';
import { Color, Move, Piece, PieceKind, Rules, Square } from './types.js';

interface CaptureStep {
  readonly victimSq: Square;
  readonly landingSquares: readonly Square[];
  readonly dir: number;
}

export class MoveGenerator {
  private readonly rules: Rules;
  private readonly geometry: BoardGeometry;

  constructor(rules: Rules) {
    this.rules = rules;
    this.geometry = getBoardGeometry(rules.boardSize);
  }

  generateLegalMoves(
    pieces: readonly (Piece | null)[],
    turn: Color,
  ): Move[] {
    const captures = this.generateAllCaptures(pieces, turn);
    if (captures.length > 0) {
      return this.filterCapturesByRule(captures);
    }
    return this.generateQuietMoves(pieces, turn);
  }

  generateAllCaptures(
    pieces: readonly (Piece | null)[],
    turn: Color,
  ): Move[] {
    const allCaptures: Move[] = [];

    for (let sq = 0; sq < this.geometry.squareCount; sq++) {
      const piece = pieces[sq];
      if (piece !== null && piece.color === turn) {
        const pieceCaptures = this.generatePieceCaptures(pieces, sq, piece);
        for (let i = 0; i < pieceCaptures.length; i++) {
          allCaptures.push(pieceCaptures[i]);
        }
      }
    }

    return allCaptures;
  }

  generatePieceCaptures(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    piece: Piece,
  ): Move[] {
    const results: Move[] = [];
    const capturedSet = new Set<Square>();

    this.searchCapturesRecursive(
      pieces,
      originSq,
      originSq,
      piece.color,
      piece.kind,
      false,
      [],
      [],
      capturedSet,
      results,
    );

    return results;
  }

  private searchCapturesRecursive(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    currentSq: Square,
    color: Color,
    currentKind: PieceKind,
    promotedAlready: boolean,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    capturedSet: Set<Square>,
    results: Move[],
  ): boolean {
    const steps =
      currentKind === 'king' && this.rules.kingsFly
        ? this.findFlyingKingCaptureSteps(
            pieces,
            originSq,
            currentSq,
            color,
            capturedSet,
          )
        : this.findShortCaptureSteps(
            pieces,
            originSq,
            currentSq,
            color,
            currentKind,
            capturedSet,
          );

    if (steps.length === 0) {
      if (capturedSoFar.length > 0) {
        const finalPromotes =
          promotedAlready ||
          (currentKind === 'man' &&
            this.geometry.isPromotionSquare(currentSq, color));

        results.push({
          from: originSq,
          path: [...pathSoFar],
          captured: [...capturedSoFar],
          promotes: finalPromotes,
        });
        return true;
      }
      return false;
    }

    let foundAnyBranch = false;

    for (let s = 0; s < steps.length; s++) {
      const step = steps[s];
      capturedSet.add(step.victimSq);
      capturedSoFar.push(step.victimSq);

      if (currentKind === 'king' && this.rules.kingsFly) {
        const continuations: Move[] = [];
        const terminalLandings: Square[] = [];

        for (let l = 0; l < step.landingSquares.length; l++) {
          const landSq = step.landingSquares[l];
          pathSoFar.push(landSq);

          const branchMoves: Move[] = [];
          this.searchKingContinuation(
            pieces,
            originSq,
            landSq,
            color,
            promotedAlready,
            pathSoFar,
            capturedSoFar,
            capturedSet,
            branchMoves,
          );

          if (branchMoves.length > 0) {
            for (let b = 0; b < branchMoves.length; b++) {
              continuations.push(branchMoves[b]);
            }
          } else {
            terminalLandings.push(landSq);
          }

          pathSoFar.pop();
        }

        if (continuations.length > 0) {
          for (let c = 0; c < continuations.length; c++) {
            results.push(continuations[c]);
          }
          foundAnyBranch = true;
        } else {
          for (let t = 0; t < terminalLandings.length; t++) {
            const landSq = terminalLandings[t];
            results.push({
              from: originSq,
              path: [...pathSoFar, landSq],
              captured: [...capturedSoFar],
              promotes: promotedAlready,
            });
            foundAnyBranch = true;
          }
        }
      } else {
        const landSq = step.landingSquares[0];
        pathSoFar.push(landSq);

        const reachesPromotion =
          currentKind === 'man' &&
          this.geometry.isPromotionSquare(landSq, color);

        if (reachesPromotion) {
          const promoRule = this.rules.promotionDuringCapture;

          if (promoRule === 'ends-move') {
            results.push({
              from: originSq,
              path: [...pathSoFar],
              captured: [...capturedSoFar],
              promotes: true,
            });
            foundAnyBranch = true;
          } else if (promoRule === 'continue-as-king') {
            this.searchCapturesRecursive(
              pieces,
              originSq,
              landSq,
              color,
              'king',
              true,
              pathSoFar,
              capturedSoFar,
              capturedSet,
              results,
            );
            foundAnyBranch = true;
          } else if (promoRule === 'stay-man-if-continues') {
            const subResults: Move[] = [];
            this.searchCapturesRecursive(
              pieces,
              originSq,
              landSq,
              color,
              'man',
              false,
              pathSoFar,
              capturedSoFar,
              capturedSet,
              subResults,
            );
            for (let sr = 0; sr < subResults.length; sr++) {
              results.push(subResults[sr]);
            }
            foundAnyBranch = true;
          }
        } else {
          this.searchCapturesRecursive(
            pieces,
            originSq,
            landSq,
            color,
            currentKind,
            promotedAlready,
            pathSoFar,
            capturedSoFar,
            capturedSet,
            results,
          );
          foundAnyBranch = true;
        }

        pathSoFar.pop();
      }

      capturedSoFar.pop();
      capturedSet.delete(step.victimSq);
    }

    return foundAnyBranch;
  }

  private searchKingContinuation(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    landSq: Square,
    color: Color,
    promotedAlready: boolean,
    pathSoFar: Square[],
    capturedSoFar: Square[],
    capturedSet: Set<Square>,
    branchMoves: Move[],
  ): void {
    const nextSteps = this.findFlyingKingCaptureSteps(
      pieces,
      originSq,
      landSq,
      color,
      capturedSet,
    );

    if (nextSteps.length === 0) {
      return;
    }

    this.searchCapturesRecursive(
      pieces,
      originSq,
      landSq,
      color,
      'king',
      promotedAlready,
      pathSoFar,
      capturedSoFar,
      capturedSet,
      branchMoves,
    );
  }

  private findShortCaptureSteps(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    currentSq: Square,
    color: Color,
    kind: PieceKind,
    capturedSet: Set<Square>,
  ): CaptureStep[] {
    const dirs =
      kind === 'king' || this.rules.menCaptureBackward
        ? ALL_DIRECTIONS
        : this.geometry.forwardDirections(color);

    const steps: CaptureStep[] = [];

    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i];
      const midSq = this.geometry.neighbors[currentSq][dir];
      if (midSq === -1) {
        continue;
      }

      const landSq = this.geometry.neighbors[midSq][dir];
      if (landSq === -1) {
        continue;
      }

      if (capturedSet.has(midSq)) {
        continue;
      }

      const midPiece = midSq === originSq ? null : pieces[midSq];
      if (midPiece === null || midPiece.color === color) {
        continue;
      }

      if (!this.isSquareEmptyDuringMove(pieces, originSq, landSq, capturedSet)) {
        continue;
      }

      steps.push({
        victimSq: midSq,
        landingSquares: [landSq],
        dir,
      });
    }

    return steps;
  }

  private findFlyingKingCaptureSteps(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    currentSq: Square,
    color: Color,
    capturedSet: Set<Square>,
  ): CaptureStep[] {
    const steps: CaptureStep[] = [];

    for (let dir = 0; dir < 4; dir++) {
      const ray = this.geometry.rays[currentSq][dir];
      let victimSq: Square | -1 = -1;
      const landingSquares: Square[] = [];

      for (let r = 0; r < ray.length; r++) {
        const sq = ray[r];
        const isEmpty = this.isSquareEmptyDuringMove(
          pieces,
          originSq,
          sq,
          capturedSet,
        );

        if (victimSq === -1) {
          if (isEmpty) {
            continue;
          }
          if (capturedSet.has(sq)) {
            break;
          }
          const occupant = sq === originSq ? null : pieces[sq];
          if (occupant !== null && occupant.color !== color) {
            victimSq = sq;
          } else {
            break;
          }
        } else {
          if (isEmpty) {
            landingSquares.push(sq);
          } else {
            break;
          }
        }
      }

      if (victimSq !== -1 && landingSquares.length > 0) {
        steps.push({
          victimSq,
          landingSquares,
          dir,
        });
      }
    }

    return steps;
  }

  private isSquareEmptyDuringMove(
    pieces: readonly (Piece | null)[],
    originSq: Square,
    sq: Square,
    capturedSet: Set<Square>,
  ): boolean {
    if (capturedSet.has(sq)) {
      return false;
    }
    if (sq === originSq) {
      return true;
    }
    return pieces[sq] === null;
  }

  private filterCapturesByRule(captures: Move[]): Move[] {
    if (this.rules.captureChoice === 'maximum') {
      let maxCount = 0;
      for (let i = 0; i < captures.length; i++) {
        if (captures[i].captured.length > maxCount) {
          maxCount = captures[i].captured.length;
        }
      }
      return captures.filter((m) => m.captured.length === maxCount);
    }
    return captures;
  }

  generateQuietMoves(
    pieces: readonly (Piece | null)[],
    turn: Color,
  ): Move[] {
    const moves: Move[] = [];

    for (let sq = 0; sq < this.geometry.squareCount; sq++) {
      const piece = pieces[sq];
      if (piece === null || piece.color !== turn) {
        continue;
      }

      if (piece.kind === 'man') {
        const forwardDirs = this.geometry.forwardDirections(turn);
        for (let i = 0; i < forwardDirs.length; i++) {
          const dir = forwardDirs[i];
          const targetSq = this.geometry.neighbors[sq][dir];
          if (targetSq !== -1 && pieces[targetSq] === null) {
            const promotes = this.geometry.isPromotionSquare(targetSq, turn);
            moves.push({
              from: sq,
              path: [targetSq],
              captured: [],
              promotes,
            });
          }
        }
      } else {
        if (this.rules.kingsFly) {
          for (let dir = 0; dir < 4; dir++) {
            const ray = this.geometry.rays[sq][dir];
            for (let r = 0; r < ray.length; r++) {
              const targetSq = ray[r];
              if (pieces[targetSq] === null) {
                moves.push({
                  from: sq,
                  path: [targetSq],
                  captured: [],
                  promotes: false,
                });
              } else {
                break;
              }
            }
          }
        } else {
          for (let dir = 0; dir < 4; dir++) {
            const targetSq = this.geometry.neighbors[sq][dir];
            if (targetSq !== -1 && pieces[targetSq] === null) {
              moves.push({
                from: sq,
                path: [targetSq],
                captured: [],
                promotes: false,
              });
            }
          }
        }
      }
    }

    return moves;
  }
}

export function movesEqual(a: Move, b: Move): boolean {
  if (a.from !== b.from || a.promotes !== b.promotes) {
    return false;
  }
  if (a.path.length !== b.path.length || a.captured.length !== b.captured.length) {
    return false;
  }
  for (let i = 0; i < a.path.length; i++) {
    if (a.path[i] !== b.path[i]) {
      return false;
    }
  }
  for (let i = 0; i < a.captured.length; i++) {
    if (a.captured[i] !== b.captured[i]) {
      return false;
    }
  }
  return true;
}

