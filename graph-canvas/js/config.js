// js/config.js - Centralized Config (fisse + mutabili runtime)
export const config = {
  // Costanti fisse (non modificare runtime)
  TOTAL_NODES: 150,
  REG_ROWS: 3,
  REG_COLS: 3,
  NUM_REGIONS: 9,
  START_REGION: 3,  // B1
  GOAL_REGION: 5,   // B3
  CELL_SIZE: 160,
  SCALE: 1.25,
  K_EXTRA: 2,
  CONE_ANGLE: 80,
  SIM_MAX_TURNS: 150,
  PLAYBACK_DELAY: 600,
  PATROL_DEPTH_DEFAULT: 2,

  // Variabili mutabili runtime (dal FE)
  patrolDepth: 1,  // Default da qui per readParams
  coneAngle: 80,
  backdoorPct: 8,  // Default da qui per readParams
  minLen: 3,  // Default da qui per readParams
  maxLen: 6,  // Default da qui per readParams
  diagonalBiasPct: 70,
  degree3Pct: 30,  // Default % nodi con 3 edges
  degree4Pct: 15,
  // Aggiungi altre se serve
};

// Helper per reset a default (opzionale, chiama dal FE)
export function resetConfig() {
  config.patrolDepth = config.PATROL_DEPTH_DEFAULT;
  config.coneAngle = config.CONE_ANGLE;
  config.backdoorPct = 8;
  config.minLen = 3;
  config.maxLen = 6;
  config.diagonalBiasPct = 70;
}