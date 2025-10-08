import { config } from './config.js';  // Fix: Importa oggetto config

export function generateRegions() {
  const regs = [];
  const w = config.CELL_SIZE * config.SCALE, h = config.CELL_SIZE * config.SCALE;  // Fix: Usa config.KEY
  for (let r = 0; r < config.REG_ROWS; r++) {  // Fix: Usa config.REG_ROWS
    for (let c = 0; c < config.REG_COLS; c++) {  // Fix: Usa config.REG_COLS
      const id = r * config.REG_COLS + c;
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