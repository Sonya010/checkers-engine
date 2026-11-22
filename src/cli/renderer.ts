import { formatMove } from '../notation/move-notation.js';
import { getBoardGeometry } from '../rules/board.js';
import { Piece, Position } from '../rules/types.js';

const FILE_HEADERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

export function formatPieceSymbol(piece: Piece | null): string {
  if (piece === null) {
    return '.';
  }
  if (piece.color === 'white') {
    return piece.kind === 'king' ? 'W' : 'w';
  }
  return piece.kind === 'king' ? 'B' : 'b';
}

export function renderBoard(position: Position): string {
  const size = position.rules.boardSize;
  const geometry = getBoardGeometry(size);
  const showNumbers = position.rules.id !== 'ukrainian';
  const squaresPerRow = size / 2;
  const lines: string[] = [];

  const fileRow = '    ' + FILE_HEADERS.slice(0, size).join(' ');
  lines.push(fileRow);
  lines.push('  +' + '-'.repeat(size * 2 + 1) + '+');

  for (let r = 0; r < size; r++) {
    const rankLabel = String(size - r).padStart(2, ' ');
    const cells: string[] = [];

    for (let c = 0; c < size; c++) {
      const sq = geometry.squareFromCoords(r, c);
      if (sq === -1) {
        cells.push(' ');
      } else {
        cells.push(formatPieceSymbol(position.pieceAt(sq)));
      }
    }

    const firstNum = r * squaresPerRow + 1;
    const lastNum = (r + 1) * squaresPerRow;
    const numSuffix = showNumbers
      ? `   (${String(firstNum).padStart(2, ' ')}-${String(lastNum).padStart(2, ' ')})`
      : '';

    lines.push(`${rankLabel}| ${cells.join(' ')} |${rankLabel}${numSuffix}`);
  }

  lines.push('  +' + '-'.repeat(size * 2 + 1) + '+');
  lines.push(fileRow);

  return lines.join('\n');
}

export function renderPositionSummary(position: Position): string {
  const boardText = renderBoard(position);
  const status = position.status();
  const legal = position.legalMoves();
  const formattedMoves = legal.map((m) => formatMove(m, position.rules));

  const infoLines: string[] = [
    boardText,
    `Rules: ${position.rules.id} | Turn: ${position.turn}`,
  ];

  if (status.kind === 'ongoing') {
    infoLines.push(
      `Legal moves (${formattedMoves.length}): ${formattedMoves.join(', ')}`,
    );
  } else if (status.kind === 'win') {
    infoLines.push(`Game Over: ${status.winner} wins!`);
  } else {
    infoLines.push(`Game Over: Draw (${status.reason})`);
  }

  return infoLines.join('\n');
}
