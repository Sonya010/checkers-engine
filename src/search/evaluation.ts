import { Color, Piece, Position } from '../rules/types.js';
import { EvaluationWeights } from './types.js';

export const WIN_SCORE = 100000;
export const DRAW_SCORE = 0;

export const DEFAULT_EVALUATION_WEIGHTS: EvaluationWeights = Object.freeze({
  manValue: 100,
  kingValue: 300,
  advancementWeight: 4,
  centerWeight: 6,
  backRankWeight: 8,
  tempoBonus: 3,
});

export function createEvaluationWeights(
  overrides?: Partial<EvaluationWeights>,
): EvaluationWeights {
  if (!overrides) {
    return DEFAULT_EVALUATION_WEIGHTS;
  }
  return Object.freeze({
    manValue: overrides.manValue ?? DEFAULT_EVALUATION_WEIGHTS.manValue,
    kingValue: overrides.kingValue ?? DEFAULT_EVALUATION_WEIGHTS.kingValue,
    advancementWeight:
      overrides.advancementWeight ??
      DEFAULT_EVALUATION_WEIGHTS.advancementWeight,
    centerWeight:
      overrides.centerWeight ?? DEFAULT_EVALUATION_WEIGHTS.centerWeight,
    backRankWeight:
      overrides.backRankWeight ?? DEFAULT_EVALUATION_WEIGHTS.backRankWeight,
    tempoBonus: overrides.tempoBonus ?? DEFAULT_EVALUATION_WEIGHTS.tempoBonus,
  });
}

export function evaluatePosition(
  position: Position,
  perspective: Color = position.turn,
  weights: EvaluationWeights = DEFAULT_EVALUATION_WEIGHTS,
): number {
  const status = position.status();
  if (status.kind === 'win') {
    return status.winner === perspective ? WIN_SCORE : -WIN_SCORE;
  }
  if (status.kind === 'draw') {
    return DRAW_SCORE;
  }

  const boardSize = position.rules.boardSize;
  const squareCount = (boardSize * boardSize) / 2;
  const squaresPerRow = boardSize / 2;

  let whiteScore = 0;
  let blackScore = 0;

  for (let sq = 0; sq < squareCount; sq++) {
    const piece = position.pieceAt(sq);
    if (piece === null) {
      continue;
    }

    const row = Math.floor(sq / squaresPerRow);
    const colInRow = sq % squaresPerRow;
    const pieceScore = evaluateSinglePiece(
      piece,
      row,
      colInRow,
      boardSize,
      squaresPerRow,
      weights,
    );

    if (piece.color === 'white') {
      whiteScore += pieceScore;
    } else {
      blackScore += pieceScore;
    }
  }

  if (position.turn === 'white') {
    whiteScore += weights.tempoBonus;
  } else {
    blackScore += weights.tempoBonus;
  }

  const netWhite = whiteScore - blackScore;
  return perspective === 'white' ? netWhite : -netWhite;
}

function evaluateSinglePiece(
  piece: Piece,
  row: number,
  colInRow: number,
  boardSize: number,
  squaresPerRow: number,
  weights: EvaluationWeights,
): number {
  let score = piece.kind === 'king' ? weights.kingValue : weights.manValue;

  const isCenterRow = row >= 2 && row < boardSize - 2;
  const isCenterCol = colInRow >= 1 && colInRow < squaresPerRow - 1;
  if (isCenterRow && isCenterCol) {
    score += weights.centerWeight;
  } else if (isCenterRow || isCenterCol) {
    score += Math.floor(weights.centerWeight / 2);
  }

  if (piece.kind === 'man') {
    if (piece.color === 'white') {
      const advancement = boardSize - 1 - row;
      score += advancement * weights.advancementWeight;
      if (row === boardSize - 1) {
        score += weights.backRankWeight;
      }
    } else {
      const advancement = row;
      score += advancement * weights.advancementWeight;
      if (row === 0) {
        score += weights.backRankWeight;
      }
    }
  }

  return score;
}

