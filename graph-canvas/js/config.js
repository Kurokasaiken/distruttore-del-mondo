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

  // Variabili mutabili runtime (modificabili da eventi/FE)
  INTER_REGION_EDGES: 3, // Numero di archi tra regioni adiacenti
  patrolDepth: 1,
  coneAngle: 80,
  backdoorPct: 8,
  minLen: 3,
  maxLen: 6,
  diagonalBiasPct: 70,
  degree3Pct: 30,
  degree4Pct: 15,
  // ...aggiungi altre variabili runtime se serve...
};

// Helper per modificare dinamicamente i valori mutabili
export function setConfig(key, value) {
  if (key in config) config[key] = value;
}

// Helper per reset a default (opzionale, chiama dal FE)
export function resetConfig() {
  config.patrolDepth = config.PATROL_DEPTH_DEFAULT;
  config.coneAngle = config.CONE_ANGLE;
  config.backdoorPct = 8;
  config.minLen = 3;
  config.maxLen = 6;
  config.diagonalBiasPct = 70;
  config.INTER_REGION_EDGES = 3;
  config.degree3Pct = 30;
  config.degree4Pct = 15;
}