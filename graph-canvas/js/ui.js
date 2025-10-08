// ===============================
// ui.js - Main UI Controller
// ===============================

import { el, log } from './utils.js';
import { drawGraph } from './draw.js';
import { setupEventListeners } from './ui-utils.js';
import { config } from './config.js';

// Globals locali (sync con window)
let canvas = null;
let ctx = null;
let currentGraph = null;
let currentPlayerPos = null;
let playbackTrace = null;
let playbackIdx = 0;

window.canvas = canvas;
window.ctx = ctx;
window.currentGraph = currentGraph;
window.currentPlayerPos = currentPlayerPos;
window.playbackTrace = playbackTrace;
window.playbackIdx = playbackIdx;
window.redraw = null;

// Helper: Sincronizza defaults da config agli input UI
function syncDefaultsToUI() {
  const backdoorPctEl = el('backdoorPct');
  const minLenEl = el('backdoorMinLen');
  const maxLenEl = el('backdoorMaxLen');
  const diagonalBiasEl = el('diagonalBiasPct');
  const patrolDepthEl = el('patrolDepth');

  if (backdoorPctEl) backdoorPctEl.value = config.backdoorPct;
  if (minLenEl) minLenEl.value = config.minLen;
  if (maxLenEl) maxLenEl.value = config.maxLen;
  if (diagonalBiasEl) diagonalBiasEl.value = config.diagonalBiasPct;
  if (patrolDepthEl) patrolDepthEl.value = config.patrolDepth;

  console.log('[UI] Default values synced from config');
}

export async function loadPartials() {
  try {
    const container = el('panel');
    if (container) {
      const resp = await fetch('partials/panel.html');
      container.innerHTML = resp.ok ? await resp.text() : '<div>Fallback panel</div>';
    }
    syncDefaultsToUI();  // Sync defaults dopo load
    log('UI components caricati.');
    return true;
  } catch (err) {
    console.error('Load partials failed:', err);
    log('Errore caricamento interfaccia: ' + err.message);
    return false;
  }
}

function setupCanvas() {
  canvas = el('graphCanvas');
  if (!canvas) {
    console.error('Canvas mancante!');
    return false;
  }
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  return true;
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = canvas.clientWidth || Math.max(800, window.innerWidth - 320);
  canvas.height = canvas.clientHeight || Math.max(600, window.innerHeight - 100);
  redraw();
}

function redraw(controlledNodes = null, intentNodes = null) {
  // Fix: Sync locals con window prima del draw
  currentGraph = window.currentGraph;
  currentPlayerPos = window.currentPlayerPos;
  playbackTrace = window.playbackTrace;
  playbackIdx = window.playbackIdx;

  if (!canvas || !ctx) return;
  try {
    drawGraph(canvas, ctx, currentGraph, currentPlayerPos, playbackTrace, playbackIdx, controlledNodes, intentNodes);
  } catch (e) {
    console.error('drawGraph error:', e);
  }
}

function getUIElements() {
  return {
    backdoorPctEl: el('backdoorPct'),
    minLenEl: el('backdoorMinLen'),
    maxLenEl: el('backdoorMaxLen'),
    diagonalBiasEl: el('diagonalBiasPct'),
    patrolDepthEl: el('patrolDepth'),
    runBtn: el('runBtn'),
    simBtn: el('simBtn'),
  };
}

export async function initUI() {
  try {
    window.redraw = redraw;
    await loadPartials();
    if (!setupCanvas()) return;

    const elements = getUIElements();
    setupEventListeners({
      ...elements,
      canvas,
      globals: { currentGraph: window.currentGraph, currentPlayerPos: window.currentPlayerPos, playbackTrace: window.playbackTrace, playbackIdx: window.playbackIdx },
      redraw
    });

    // Sync iniziali (ridondante ma sicuro)
    currentGraph = window.currentGraph;
    currentPlayerPos = window.currentPlayerPos;
    playbackTrace = window.playbackTrace;
    playbackIdx = window.playbackIdx;

    log('🚀 Interfaccia pronta. Premi "Genera & Valida".');
    redraw();
  } catch (err) {
    console.error('UI init error:', err);
    log('Errore inizializzazione UI: ' + err.message);
  }
}

export { redraw, resizeCanvas };
export { canvas, ctx, currentGraph, currentPlayerPos, playbackTrace, playbackIdx };