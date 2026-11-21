import { Move, Position } from '../rules/types.js';
import {
  createEvaluationWeights,
  DRAW_SCORE,
  evaluatePosition,
  WIN_SCORE,
} from './evaluation.js';
import { orderMoves } from './move-ordering.js';
import { BoundFlag, TranspositionTable } from './transposition-table.js';
import {
  Bot,
  EvaluationWeights,
  MinimaxBotOptions,
  SearchResult,
  SearchStats,
} from './types.js';

const INFINITY_SCORE = 1000000;

export class MinimaxBot implements Bot {
  readonly depth: number;
  readonly useMoveOrdering: boolean;
  readonly useTranspositionTable: boolean;
  readonly weights: EvaluationWeights;
  private readonly tt: TranspositionTable | null;
  private lastSearchResult: SearchResult | null = null;

  constructor(optionsOrDepth: number | MinimaxBotOptions = 4) {
    if (typeof optionsOrDepth === 'number') {
      this.depth = Math.max(1, optionsOrDepth);
      this.useMoveOrdering = true;
      this.useTranspositionTable = true;
      this.weights = createEvaluationWeights();
      this.tt = new TranspositionTable();
    } else {
      this.depth = Math.max(1, optionsOrDepth.depth);
      this.useMoveOrdering = optionsOrDepth.useMoveOrdering ?? true;
      this.useTranspositionTable = optionsOrDepth.useTranspositionTable ?? true;
      this.weights = createEvaluationWeights(optionsOrDepth.weights);
      this.tt = this.useTranspositionTable
        ? new TranspositionTable(optionsOrDepth.ttMaxEntries ?? 100000)
        : null;
    }
  }

  getLastSearchResult(): SearchResult | null {
    return this.lastSearchResult;
  }

  clearTranspositionTable(): void {
    if (this.tt) {
      this.tt.clear();
    }
  }

  chooseMove(position: Position): Move {
    const result = this.search(position);
    return result.bestMove;
  }

  search(position: Position, customDepth?: number): SearchResult {
    const targetDepth = Math.max(1, customDepth ?? this.depth);
    const legalMoves = position.legalMoves();

    if (legalMoves.length === 0) {
      throw new Error('MinimaxBot cannot choose a move: no legal moves available');
    }

    const startTime = Date.now();
    const stats: SearchStats = {
      nodesVisited: 0,
      cutoffs: 0,
      ttHits: 0,
      ttStores: 0,
      maxDepthReached: targetDepth,
      elapsedMs: 0,
    };

    if (legalMoves.length === 1) {
      const child = position.apply(legalMoves[0]);
      const score = -this.evaluateTerminalOrLeaf(child, 1);
      stats.nodesVisited = 1;
      stats.elapsedMs = Date.now() - startTime;
      const singleResult: SearchResult = {
        bestMove: legalMoves[0],
        score,
        depth: targetDepth,
        stats,
      };
      this.lastSearchResult = singleResult;
      return singleResult;
    }

    const ttEntry = this.tt ? this.tt.lookup(position.key) : undefined;
    if (ttEntry !== undefined) {
      stats.ttHits++;
    }

    const orderedRootMoves = this.useMoveOrdering
      ? orderMoves(legalMoves, ttEntry?.bestMove)
      : [...legalMoves];

    let bestMove: Move = orderedRootMoves[0];
    let bestScore = -INFINITY_SCORE;
    let alpha = -INFINITY_SCORE;
    const beta = INFINITY_SCORE;

    for (let i = 0; i < orderedRootMoves.length; i++) {
      const move = orderedRootMoves[i];
      const nextPos = position.apply(move);
      const score = -this.negamaxAlphaBeta(
        nextPos,
        targetDepth - 1,
        1,
        -beta,
        -alpha,
        stats,
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    if (this.tt) {
      this.tt.store({
        key: position.key,
        depth: targetDepth,
        score: bestScore,
        flag: 'exact',
        bestMove,
      });
      stats.ttStores++;
    }

    stats.elapsedMs = Date.now() - startTime;
    const result: SearchResult = {
      bestMove,
      score: bestScore,
      depth: targetDepth,
      stats,
    };
    this.lastSearchResult = result;
    return result;
  }

  private negamaxAlphaBeta(
    position: Position,
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
    stats: SearchStats,
  ): number {
    stats.nodesVisited++;

    const alphaOrig = alpha;
    let ttBestMove: Move | null = null;

    if (this.tt) {
      const ttEntry = this.tt.lookup(position.key);
      if (ttEntry !== undefined) {
        stats.ttHits++;
        ttBestMove = ttEntry.bestMove;
        if (ttEntry.depth >= depth) {
          if (ttEntry.flag === 'exact') {
            return ttEntry.score;
          }
          if (ttEntry.flag === 'lowerbound' && ttEntry.score > alpha) {
            alpha = ttEntry.score;
          } else if (ttEntry.flag === 'upperbound' && ttEntry.score < beta) {
            beta = ttEntry.score;
          }
          if (alpha >= beta) {
            stats.cutoffs++;
            return ttEntry.score;
          }
        }
      }
    }

    const status = position.status();
    if (status.kind !== 'ongoing' || depth <= 0) {
      return this.evaluateTerminalOrLeaf(position, ply);
    }

    const legalMoves = position.legalMoves();
    if (legalMoves.length === 0) {
      return -(WIN_SCORE - ply);
    }

    const moves = this.useMoveOrdering
      ? orderMoves(legalMoves, ttBestMove)
      : legalMoves;

    let bestScore = -INFINITY_SCORE;
    let bestMove: Move = moves[0];

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const nextPos = position.apply(move);
      const score = -this.negamaxAlphaBeta(
        nextPos,
        depth - 1,
        ply + 1,
        -beta,
        -alpha,
        stats,
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
      if (alpha >= beta) {
        stats.cutoffs++;
        break;
      }
    }

    if (this.tt) {
      let flag: BoundFlag = 'exact';
      if (bestScore <= alphaOrig) {
        flag = 'upperbound';
      } else if (bestScore >= beta) {
        flag = 'lowerbound';
      }
      this.tt.store({
        key: position.key,
        depth,
        score: bestScore,
        flag,
        bestMove,
      });
      stats.ttStores++;
    }

    return bestScore;
  }

  private evaluateTerminalOrLeaf(position: Position, ply: number): number {
    const status = position.status();
    if (status.kind === 'win') {
      return status.winner === position.turn
        ? WIN_SCORE - ply
        : -(WIN_SCORE - ply);
    }
    if (status.kind === 'draw') {
      return DRAW_SCORE;
    }
    return evaluatePosition(position, position.turn, this.weights);
  }
}

export function plainMinimaxSearch(
  position: Position,
  depth: number,
  weights: EvaluationWeights = createEvaluationWeights(),
): SearchResult {
  const legalMoves = position.legalMoves();
  if (legalMoves.length === 0) {
    throw new Error('No legal moves in position');
  }

  const startTime = Date.now();
  const stats: SearchStats = {
    nodesVisited: 0,
    cutoffs: 0,
    ttHits: 0,
    ttStores: 0,
    maxDepthReached: depth,
    elapsedMs: 0,
  };

  let bestMove = legalMoves[0];
  let bestScore = -INFINITY_SCORE;

  for (let i = 0; i < legalMoves.length; i++) {
    const move = legalMoves[i];
    const nextPos = position.apply(move);
    const score = -plainNegamax(nextPos, depth - 1, 1, weights, stats);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  stats.elapsedMs = Date.now() - startTime;
  return {
    bestMove,
    score: bestScore,
    depth,
    stats,
  };
}

function plainNegamax(
  position: Position,
  depth: number,
  ply: number,
  weights: EvaluationWeights,
  stats: SearchStats,
): number {
  stats.nodesVisited++;

  const status = position.status();
  if (status.kind === 'win') {
    return status.winner === position.turn
      ? WIN_SCORE - ply
      : -(WIN_SCORE - ply);
  }
  if (status.kind === 'draw') {
    return DRAW_SCORE;
  }
  if (depth <= 0) {
    return evaluatePosition(position, position.turn, weights);
  }

  const legalMoves = position.legalMoves();
  if (legalMoves.length === 0) {
    return -(WIN_SCORE - ply);
  }

  let bestScore = -INFINITY_SCORE;
  for (let i = 0; i < legalMoves.length; i++) {
    const nextPos = position.apply(legalMoves[i]);
    const score = -plainNegamax(nextPos, depth - 1, ply + 1, weights, stats);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

