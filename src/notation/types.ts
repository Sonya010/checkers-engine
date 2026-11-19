import { Move, Rules } from '../rules/types.js';

export type CoordinateFormat = 'algebraic' | 'numeric';

export type PdnResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export interface PdnMoveEntry {
  readonly moveNumber?: number;
  readonly text: string;
  readonly comment?: string;
  readonly line?: number;
  readonly column?: number;
}

export interface PdnGame {
  readonly headers: Record<string, string>;
  readonly moves: string[];
  readonly moveEntries: PdnMoveEntry[];
  readonly result: PdnResult;
}

export interface ReplayedPdnGame {
  readonly pdn: PdnGame;
  readonly rules: Rules;
  readonly appliedMoves: Move[];
}
