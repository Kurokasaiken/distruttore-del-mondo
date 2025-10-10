import { el } from './utils.js';
import { config } from './config.js';

// Elementi UI principali
export const backdoorPctEl = el('backdoorPct');
export const minLenEl = el('backdoorMin');
export const maxLenEl = el('backdoorMax');
export const diagonalBiasEl = el('diagonalBias');
export const patrolDepthEl = el('patrolDepth');
export const runBtn = el('runBtn');
export const simBtn = el('simBtn');
export const canvas = el('graphCanvas');
export const interRegionEdgesEl = el('interRegionEdges');

// Helper per leggere i parametri UI con fallback ai valori di config
export function readParams(backdoorPctEl, minLenEl, maxLenEl, diagonalBiasEl, patrolDepthEl, interRegionEdgesEl) {
  return {
    backdoorPct: parseInt(backdoorPctEl?.value, 10) || config.backdoorPct,
    minLen: parseInt(minLenEl?.value, 10) || config.minLen,
    maxLen: parseInt(maxLenEl?.value, 10) || config.maxLen,
    diagonalBiasPct: parseInt(diagonalBiasEl?.value, 10) || config.diagonalBiasPct,
    patrolDepth: parseInt(patrolDepthEl?.value, 10) || config.patrolDepth,
    interRegionEdges: parseInt(interRegionEdgesEl?.value, 10) || config.INTER_REGION_EDGES
  };
}

// Funzione per impostare i valori predefiniti nei campi di input
export function setDefaultInputValues() {
  if (backdoorPctEl) backdoorPctEl.value = config.backdoorPct;
  if (minLenEl) minLenEl.value = config.minLen;
  if (maxLenEl) maxLenEl.value = config.maxLen;
  if (diagonalBiasEl) diagonalBiasEl.value = config.diagonalBiasPct;
  if (patrolDepthEl) patrolDepthEl.value = config.patrolDepth;
  if (interRegionEdgesEl) interRegionEdgesEl.value = config.INTER_REGION_EDGES;
}