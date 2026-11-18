export type Color = 'white' | 'black';

export type Square = number;

export type PieceKind = 'man' | 'king';

export interface Piece {
  color: Color;
  kind: PieceKind;
}

export interface EndgameDrawConfig {
  readonly enabled: boolean;
  readonly singleKingVsOneKingLimit: number;
  readonly singleKingVsTwoOrFewerLimit: number;
  readonly singleKingVsThreeLimit?: number;
}

export interface DrawRules {
  repetitionCount: number;
  kingMovesWithoutCaptureLimit: number;
  endgame?: EndgameDrawConfig;
}

export type VariantId = 'ukrainian' | 'english' | 'international';

export type CaptureChoice = 'any' | 'maximum';

export type PromotionDuringCapture =
  | 'continue-as-king'
  | 'ends-move'
  | 'stay-man-if-continues';

export interface Rules {
  id: VariantId;
  boardSize: 8 | 10;
  firstMover: Color;
  menCaptureBackward: boolean;
  kingsFly: boolean;
  captureChoice: CaptureChoice;
  promotionDuringCapture: PromotionDuringCapture;
  draw: DrawRules;
}

export interface Move {
  from: Square;
  path: Square[];
  captured: Square[];
  promotes: boolean;
}

export type GameStatus =
  | { kind: 'ongoing' }
  | { kind: 'win'; winner: Color }
  | { kind: 'draw'; reason: string };

export interface MaterialCount {
  readonly whiteMen: number;
  readonly whiteKings: number;
  readonly blackMen: number;
  readonly blackKings: number;
  readonly whiteTotal: number;
  readonly blackTotal: number;
}

export interface Position {
  readonly rules: Rules;
  readonly turn: Color;
  readonly key: bigint;
  pieceAt(sq: Square): Piece | null;
  legalMoves(): Move[];
  apply(move: Move): Position;
  status(): GameStatus;
}
