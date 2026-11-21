import { Move, Position } from '../rules/types.js';

export interface Bot {
  chooseMove(position: Position): Move;
}

export interface EvaluationWeights {
  readonly manValue: number;
  readonly kingValue: number;
  readonly advancementWeight: number;
  readonly centerWeight: number;
  readonly backRankWeight: number;
  readonly tempoBonus: number;
}

export interface SearchStats {
  nodesVisited: number;
  cutoffs: number;
  ttHits: number;
  ttStores: number;
  maxDepthReached: number;
  elapsedMs: number;
}

export interface SearchResult {
  readonly bestMove: Move;
  readonly score: number;
  readonly depth: number;
  readonly stats: SearchStats;
}

export interface MinimaxBotOptions {
  readonly depth: number;
  readonly useMoveOrdering?: boolean;
  readonly useTranspositionTable?: boolean;
  readonly ttMaxEntries?: number;
  readonly weights?: Partial<EvaluationWeights>;
}

export interface RandomBotOptions {
  readonly seed?: number;
}

