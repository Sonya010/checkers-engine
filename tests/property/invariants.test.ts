import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { movesEqual } from '../../src/rules/move-generator.js';
import { createInitialPosition } from '../../src/rules/position.js';
import { rotateMove180, rotatePosition180 } from '../../src/rules/symmetry.js';
import { Piece, Position, Rules } from '../../src/rules/types.js';
import { englishRules, ukrainianRules } from '../../src/rules/variants/index.js';
import { computePositionKey } from '../../src/rules/zobrist.js';

function reachPositionFromMoves(rules: Rules, indices: readonly number[]): Position {
  let pos = createInitialPosition(rules);
  for (let i = 0; i < indices.length; i++) {
    const legal = pos.legalMoves();
    if (legal.length === 0) {
      break;
    }
    const move = legal[indices[i] % legal.length];
    pos = pos.apply(move);
  }
  return pos;
}

describe('Property-based invariants (fast-check)', () => {
  it('never produces duplicate captured squares in any legal move on reachable positions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(ukrainianRules, englishRules),
        fc.array(fc.nat(50), { minLength: 1, maxLength: 35 }),
        (rules, moveIndices) => {
          const pos = reachPositionFromMoves(rules, moveIndices);
          const moves = pos.legalMoves();
          for (const move of moves) {
            const uniqueCaptured = new Set(move.captured);
            expect(uniqueCaptured.size).toBe(move.captured.length);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('maintains incremental Zobrist key consistency with full board recomputation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(ukrainianRules, englishRules),
        fc.array(fc.nat(50), { minLength: 1, maxLength: 30 }),
        (rules, moveIndices) => {
          const pos = reachPositionFromMoves(rules, moveIndices);
          const squareCount = (rules.boardSize * rules.boardSize) / 2;
          const pieces: (Piece | null)[] = [];
          for (let sq = 0; sq < squareCount; sq++) {
            pieces.push(pos.pieceAt(sq));
          }
          const recomputedKey = computePositionKey(pieces, pos.turn);
          expect(pos.key).toBe(recomputedKey);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('preserves 180-degree board rotation symmetry with color inversion', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(ukrainianRules, englishRules),
        fc.array(fc.nat(50), { minLength: 0, maxLength: 25 }),
        (rules, moveIndices) => {
          const pos = reachPositionFromMoves(rules, moveIndices);
          const rotatedPos = rotatePosition180(pos);

          const originalMovesRotated = pos
            .legalMoves()
            .map((m) => rotateMove180(m, rules.boardSize));
          const rotatedLegalMoves = rotatedPos.legalMoves();

          expect(rotatedLegalMoves).toHaveLength(originalMovesRotated.length);
          for (const rm of originalMovesRotated) {
            expect(rotatedLegalMoves.some((m) => movesEqual(m, rm))).toBe(true);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

