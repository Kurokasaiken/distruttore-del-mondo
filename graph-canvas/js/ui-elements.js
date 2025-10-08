import { el } from './utils.js';

export function setupElements() {
  const backdoorPctEl = el('backdoorPct');
  const minLenEl = el('backdoorMinLen');
  const maxLenEl = el('backdoorMaxLen');
  const diagonalBiasEl = el('diagonalBiasPct');
  const patrolDepthEl = el('patrolDepth');
  const runBtn = el('runBtn');
  const simBtn = el('simBtn');
  const infoEl = el('info');

  return {
    ok: !!(backdoorPctEl && minLenEl && maxLenEl && diagonalBiasEl && patrolDepthEl && runBtn && simBtn && infoEl),
    backdoorPctEl, minLenEl, maxLenEl, diagonalBiasEl, patrolDepthEl, runBtn, simBtn, infoEl
  };
}

export function readParams(backdoorPctEl, minLenEl, maxLenEl, diagonalBiasEl, patrolDepthEl,degree3El,degree4El) {
  return {
    backdoorPct: parseFloat(backdoorPctEl?.value) || 8,
    minLen: parseInt(minLenEl?.value, 10) || 3,
    maxLen: parseInt(maxLenEl?.value, 10) || 6,
    diagonalBiasPct: parseFloat(diagonalBiasEl?.value) || 70,
    patrolDepth: parseInt(patrolDepthEl?.value, 10) || 2,
    patrolDepth: parseInt(patrolDepthEl?.value, 10) || config.patrolDepth,
    degree3Pct: parseFloat(degree3El?.value) || config.degree3Pct,
    degree4Pct: parseFloat(degree4El?.value) || config.degree4Pct
  };
}