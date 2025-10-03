import { REG_ROWS, REG_COLS, CELL_SIZE, SCALE } from './config.js';

export function generateRegions() {
  const regs = [];
  const w = CELL_SIZE * SCALE, h = CELL_SIZE * SCALE;
  for (let r = 0; r < REG_ROWS; r++) {
    for (let c = 0; c < REG_COLS; c++) {
      const id = r * REG_COLS + c;
      const x0 = c * w, y0 = r * h;
      regs.push({
        id, name: String.fromCharCode(65 + r) + String(c + 1),
        bbox: { x0, y0, x1: x0 + w, y1: y0 + h },
        seed: [x0 + w / 2, y0 + h / 2]
      });
    }
  }
  return regs;
}