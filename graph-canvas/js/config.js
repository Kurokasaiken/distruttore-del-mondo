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
  patrolDepth: 2,      // Iniziale, modifica via UI
  coneAngle: 80,       // Idem
  backdoorPct: 8,      // Default per UI
  minLen: 3,
  maxLen: 6,
  diagonalBiasPct: 70,
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