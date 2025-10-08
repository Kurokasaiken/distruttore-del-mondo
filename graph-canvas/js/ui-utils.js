// ===============================
// ui-utils.js - UI Utilities and Event Handlers
// ===============================

import { log } from './utils.js';
import { readParams } from './ui-elements.js';
import { generateAndValidate, logPercentDiagonal, initPatrolsAndHighlight } from './ui-handlers.js';
import { simulateTrace, playTrace, markPatrolControl } from './simulate.js';
import { drawGraph } from './draw.js';
import { config } from './config.js';

export function setupStaticInfo(container) {
  if (!container) {
    console.warn('setupStaticInfo: No container provided');
    return;
  }

  const header = document.createElement('h1');
  header.textContent = 'Graph Patrol Simulator';
  header.style.cssText = 'text-align: center; color: #60a5fa; margin: 10px 0; font-family: Inter, sans-serif;';
  container.appendChild(header);

  const infoDiv = document.createElement('div');
  infoDiv.innerHTML = `
    <p><strong>Controls:</strong> Use "Genera & Valida" to create a map, "Simula" to run playback.</p>
    <p><strong>Params:</strong> Adjust backdoor %, lengths, bias, and patrol depth.</p>
    <small>Version: 1.0 | Date: ${new Date().toISOString().split('T')[0]}</small>
  `;
  infoDiv.style.cssText = 'background: rgba(3,7,16,0.5); padding: 10px; border-radius: 8px; margin: 10px 0; color: #e2e8f0; font-size: 14px;';
  container.appendChild(infoDiv);

  const footer = document.createElement('footer');
  footer.textContent = 'Built with JS modules | Help: Check console for logs';
  footer.style.cssText = 'text-align: center; color: rgba(148,163,184,0.7); font-size: 12px; margin-top: 20px;';
  container.appendChild(footer);

  console.log('Static UI setup complete');
  log('UI inizializzata.');
}

export function setupEventListeners(elements) {
  const { 
    backdoorPctEl, minLenEl, maxLenEl, diagonalBiasEl, patrolDepthEl, runBtn, simBtn, 
    canvas,
    globals: { currentGraph, currentPlayerPos, playbackTrace, playbackIdx },
    redraw
  } = elements;

  let playbackTimer = null;

  // Handler per "Genera & Valida" (runBtn)
  runBtn?.addEventListener('click', async () => {
    try {
      console.log('RunBtn clicked');
      const params = readParams(backdoorPctEl, minLenEl, maxLenEl, diagonalBiasEl, patrolDepthEl);
      // Update config runtime per persistenza
      config.backdoorPct = params.backdoorPct;
      config.minLen = params.minLen;
      config.maxLen = params.maxLen;
      config.diagonalBiasPct = params.diagonalBiasPct;
      log('Generazione: backdoorPct=' + params.backdoorPct + ', min=' + params.minLen + ', max=' + params.maxLen + ', diagonalBias=' + params.diagonalBiasPct + '%');
      console.log('Params:', params);

      const result = await generateAndValidate(params);
      if (result.success) {
        window.currentPlayerPos = result.graph.nodes.find(n => n.type === 'start')?.id ?? null;
        console.log('Player pos set:', window.currentPlayerPos);
        window.currentGraph = result.graph;  // Imposta globale
        log('Grafo valido generato.');
        logPercentDiagonal(result.graph, params.diagonalBiasPct);
        initPatrolsAndHighlight(result.graph, params.patrolDepth);
        // Chiama redraw dopo l'assegnazione (sync in ui.js lo fa funzionare)
        window.redraw();  // ← Qui: ridisegna subito dopo impostare il graph
      } else {
        log('Nessun grafo valido entro 30 tentativi. Ultimi errori: ' + result.last.failures.join('; '));
        console.log('No success, last check:', result.last);
      }
    } catch (error) {
      console.error('Errore in run handler:', error);
      log('Errore: ' + (error.message || String(error)));
    }
  });

  // Handler per "Gioca Run" (simBtn)
  simBtn?.addEventListener('click', () => {
    if (!window.currentGraph) {
      alert('Genera prima un grafo valido');
      return;
    }
    const res = simulateTrace(window.currentGraph);
    if (!res) {
      log('Simulazione fallita.');
      return;
    }
    if (res.outcome === 'victory') log('Victory in ' + res.turns + ' turns');
    else if (res.outcome === 'captured') log('Captured in ' + res.turns + ' turns');
    else log('Timeout');

    window.playbackTrace = res.trace || res;
    window.playbackIdx = 0;

    if (typeof playTrace === 'function') {
      try {
        playTrace({ trace: window.playbackTrace }, (idx) => {
          window.playbackIdx = idx;
          drawGraph(window.currentGraph, canvas, null, window.playbackTrace, window.playbackIdx);
        }, config.PLAYBACK_DELAY);
      } catch (err) {
        console.warn('playTrace failed, using fallback:', err);
        fallbackPlayback();
      }
    } else {
      fallbackPlayback();
    }

    function fallbackPlayback() {
      if (playbackTimer) clearInterval(playbackTimer);
      let localIdx = 0;
      playbackTimer = setInterval(() => {
        localIdx++;
        if (localIdx >= window.playbackTrace.length) { 
          clearInterval(playbackTimer); 
          playbackTimer = null; 
          return; 
        }
        drawGraph(window.currentGraph, canvas, null, window.playbackTrace, localIdx);
      }, config.PLAYBACK_DELAY);
    }
  });

  // Handler per input "Perception Depth" (patrolDepthEl)
  patrolDepthEl?.addEventListener('input', () => {
    const newDepth = parseInt(patrolDepthEl.value, 10) || config.PATROL_DEPTH_DEFAULT;
    config.patrolDepth = newDepth;  // Update centralizzato
    if (!window.currentGraph) {
      log(`Perception depth impostata a ${newDepth} (grafico mancante)`);
      return;
    }

    if (Array.isArray(window.currentGraph.patrols)) {
      window.currentGraph.patrols.forEach(p => p.perceptionDepth = newDepth);
    }
    if (Array.isArray(window.playbackTrace)) {
      window.playbackTrace.forEach(state => {
        (state.patrols || []).forEach(p => p.perceptionDepth = newDepth);
      });
    }

    const { controlledNodes, intentNodes } = markPatrolControl(window.currentGraph.patrols || [], window.currentGraph, newDepth);

    drawGraph(window.currentGraph, canvas, window.currentPlayerPos, window.playbackTrace, window.playbackIdx, controlledNodes, intentNodes);
    log(`Perception depth aggiornata a ${newDepth}`);
    // ← Qui: redraw è già chiamato via drawGraph, ma se serve extra: window.redraw();
  });

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Salva Grafo';
  saveBtn.className = 'btn';
  saveBtn.addEventListener('click', () => {
    if (!window.currentGraph) return alert('Genera prima!');
    const dataStr = JSON.stringify(window.currentGraph, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-map.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  simBtn?.parentNode?.appendChild(saveBtn);
}