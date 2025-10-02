// main.js - inizializzazione e gestione UI
import { el, log } from './utils.js';
import { generateRegions, distributeNodes, buildEdges } from './graph.js';
import { addBackdoors, checkBackdoorValidity } from './backdoor.js';
import { drawGraph } from './draw.js';

let currentGraph = null;
let currentPlayerPos = null;

// --------------------
// Funzioni principali
// --------------------

// Funzione di test backdoor (estendibile)
function runGraphTests(graph, minLen, maxLen) {
  return checkBackdoorValidity(graph, minLen, maxLen);
}

// Generazione grafo
function handleGenerate() {
  const attemptsMax = parseInt(el('attemptsMax').value, 10) || 30;
  const backdoorPct = parseFloat(el('backdoorPct').value) || 8;
  const minLen = parseInt(el('backdoorMin').value, 10) || 3;
  const maxLen = parseInt(el('backdoorMax').value, 10) || 6;

  log(`Generazione: backdoorPct=${backdoorPct}, min=${minLen}, max=${maxLen}`);

  let success = false;
  let lastCheck = null;

  for (let i = 1; i <= attemptsMax; i++) {
    const regions = generateRegions();
    const nodes = distributeNodes(regions);
    let edges = buildEdges(nodes, regions, backdoorPct, minLen, maxLen);
    edges = addBackdoors(nodes, regions, edges, backdoorPct, minLen, maxLen);

    // Definisci start/goal
    const s = nodes.find(n => n.region === 3); if (s) s.type = 'start';
    const g = nodes.find(n => n.region === 5); if (g) g.type = 'goal';

    const graph = {
      regions,
      nodes,
      edges,
      params: { backdoorPct, minLen, maxLen }
    };

    const check = runGraphTests(graph, minLen, maxLen);

    if (check.failures.length === 0) {
      currentGraph = graph;
      success = true;
      lastCheck = check;
      break;
    } else {
      log(`Tentativo ${i} fallito (${check.failures.length} issue)`);
      lastCheck = check;
    }
  }

  if (!success) {
    log(`❌ Nessun grafo valido entro ${attemptsMax} tentativi. Ultimo check: ${JSON.stringify(lastCheck)}`);
    drawGraph(null, el('graphCanvas'));
    return;
  }

  // Posizione iniziale giocatore
  currentPlayerPos = currentGraph.nodes.find(n => n.type === 'start').id;

  drawGraph(currentGraph, el('graphCanvas'), currentPlayerPos);
  log('✅ Grafo valido generato.');
}

// Simulazione (stub da estendere)
function handleSimulate() {
  if (!currentGraph) {
    log('⚠️ Nessun grafo da simulare. Genera prima un grafo valido.');
    return;
  }
  log('▶️ Simulazione non ancora implementata.');
}

// --------------------
// Sistema di test extra
// --------------------
function runFullGraphTests() {
  if (!currentGraph) {
    alert('Genera prima un grafo valido');
    return;
  }

  const nodes = currentGraph.nodes || [];
  const edges = currentGraph.edges || [];
  const startNode = nodes.find(n => n.type === 'start');
  const goalNode = nodes.find(n => n.type === 'goal');
  const backdoors = edges.filter(e => e.type === 'backdoor');

  const report = [];

  // Check nodi
  report.push(`Nodi totali: ${nodes.length}`);

  // Check edges validi
  const invalidEdges = edges.filter(e => !nodes[e.source] || !nodes[e.target]);
  report.push(invalidEdges.length === 0 
    ? `✅ Tutti gli edge validi (${edges.length})`
    : `❌ Edge non validi: ${invalidEdges.length}`);

  // Check backdoors
  const targetBackdoors = Math.round((currentGraph.params.backdoorPct / 100) * nodes.length);
  report.push(backdoors.length >= targetBackdoors
    ? `✅ Backdoors ok: ${backdoors.length}`
    : `❌ Backdoors insufficienti: ${backdoors.length} (atteso: ${targetBackdoors})`);

  // Shortest path (placeholder: da implementare BFS/DFS)
  if (startNode && goalNode) {
    report.push(`🔎 Start=${startNode.id}, Goal=${goalNode.id}`);
  }

  // Render test
  try {
    drawGraph(currentGraph, el('graphCanvas'), currentPlayerPos);
    report.push('✅ Render test ok');
  } catch (e) {
    report.push('❌ Render fallito: ' + e.message);
  }

  document.getElementById('report').textContent = report.join('\n');
  log('🧪 Test eseguito.');
}

// --------------------
// Event listeners
// --------------------
el('genBtn').addEventListener('click', handleGenerate);
el('simBtn').addEventListener('click', handleSimulate);
el('testBtn')?.addEventListener('click', runFullGraphTests); // aggiungi pulsante Test in HTML

// --------------------
// Init
// --------------------
log('Interfaccia pronta. Premi Genera & Valida.');
drawGraph(null, el('graphCanvas'));
