import { Color, Square } from './types.js';

export const DIR_NW = 0;
export const DIR_NE = 1;
export const DIR_SW = 2;
export const DIR_SE = 3;

export const ALL_DIRECTIONS: number[] = [DIR_NW, DIR_NE, DIR_SW, DIR_SE];
export const WHITE_FORWARD_DIRS: number[] = [DIR_NW, DIR_NE];
export const BLACK_FORWARD_DIRS: number[] = [DIR_SW, DIR_SE];

const DELTAS: readonly [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export interface Coordinates {
  readonly row: number;
  readonly col: number;
}

export interface BoardGeometry {
  readonly size: 8 | 10;
  readonly squareCount: number;
  readonly piecesPerPlayer: number;
  readonly rows: number;
  readonly cols: number;
  readonly squares: readonly Square[];
  readonly coords: readonly Coordinates[];
  readonly neighbors: readonly (readonly number[])[];
  readonly rays: readonly (readonly (readonly number[])[])[];
  readonly whitePromotionSquares: ReadonlySet<Square>;
  readonly blackPromotionSquares: ReadonlySet<Square>;
  squareFromCoords(row: number, col: number): Square | -1;
  isPromotionSquare(sq: Square, color: Color): boolean;
  forwardDirections(color: Color): readonly number[];
  backwardDirections(color: Color): readonly number[];
}

class BoardGeometryImpl implements BoardGeometry {
  readonly size: 8 | 10;
  readonly squareCount: number;
  readonly piecesPerPlayer: number;
  readonly rows: number;
  readonly cols: number;
  readonly squares: readonly Square[];
  readonly coords: readonly Coordinates[];
  readonly neighbors: readonly (readonly number[])[];
  readonly rays: readonly (readonly (readonly number[])[])[];
  readonly whitePromotionSquares: ReadonlySet<Square>;
  readonly blackPromotionSquares: ReadonlySet<Square>;

  private readonly gridToSquare: number[][];

  constructor(size: 8 | 10) {
    this.size = size;
    this.rows = size;
    this.cols = size;
    this.squareCount = (size * size) / 2;
    this.piecesPerPlayer = size === 8 ? 12 : 20;

    const squaresArr: Square[] = [];
    const coordsArr: Coordinates[] = [];
    this.gridToSquare = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => -1),
    );

    let index = 0;
    const squaresPerRow = size / 2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if ((r + c) % 2 === 1) {
          squaresArr.push(index);
          coordsArr.push({ row: r, col: c });
          this.gridToSquare[r][c] = index;
          index++;
        }
      }
    }

    this.squares = Object.freeze(squaresArr);
    this.coords = Object.freeze(coordsArr);

    const whitePromo = new Set<Square>();
    for (let i = 0; i < squaresPerRow; i++) {
      whitePromo.add(i);
    }
    this.whitePromotionSquares = whitePromo;

    const blackPromo = new Set<Square>();
    for (let i = this.squareCount - squaresPerRow; i < this.squareCount; i++) {
      blackPromo.add(i);
    }
    this.blackPromotionSquares = blackPromo;

    const neighborsArr: number[][] = [];
    const raysArr: number[][][] = [];

    for (let sq = 0; sq < this.squareCount; sq++) {
      const { row, col } = coordsArr[sq];
      const sqNeighbors: number[] = [];
      const sqRays: number[][] = [];

      for (let dir = 0; dir < 4; dir++) {
        const [dr, dc] = DELTAS[dir];
        const nr = row + dr;
        const nc = col + dc;

        if (this.inBounds(nr, nc)) {
          sqNeighbors.push(this.gridToSquare[nr][nc]);
        } else {
          sqNeighbors.push(-1);
        }

        const ray: number[] = [];
        let currR = row + dr;
        let currC = col + dc;
        while (this.inBounds(currR, currC)) {
          ray.push(this.gridToSquare[currR][currC]);
          currR += dr;
          currC += dc;
        }
        sqRays.push(Object.freeze(ray) as number[]);
      }

      neighborsArr.push(Object.freeze(sqNeighbors) as number[]);
      raysArr.push(Object.freeze(sqRays) as number[][]);
    }

    this.neighbors = Object.freeze(neighborsArr);
    this.rays = Object.freeze(raysArr);
  }

  private inBounds(row: number, col: number): boolean {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  squareFromCoords(row: number, col: number): Square | -1 {
    if (!this.inBounds(row, col)) {
      return -1;
    }
    return this.gridToSquare[row][col];
  }

  isPromotionSquare(sq: Square, color: Color): boolean {
    return color === 'white'
      ? this.whitePromotionSquares.has(sq)
      : this.blackPromotionSquares.has(sq);
  }

  forwardDirections(color: Color): readonly number[] {
    return color === 'white' ? WHITE_FORWARD_DIRS : BLACK_FORWARD_DIRS;
  }

  backwardDirections(color: Color): readonly number[] {
    return color === 'white' ? BLACK_FORWARD_DIRS : WHITE_FORWARD_DIRS;
  }
}

const geometryCache = new Map<number, BoardGeometry>();

export function getBoardGeometry(size: 8 | 10): BoardGeometry {
  let geo = geometryCache.get(size);
  if (!geo) {
    geo = new BoardGeometryImpl(size);
    geometryCache.set(size, geo);
  }
  return geo;
}

