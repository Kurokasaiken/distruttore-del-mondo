// js/graph.js
// ===============================
// graph.js - Core Graph Builder
// ===============================

import { generateRegions } from './regions.js';
import { distributeNodes, nearestInRegion } from './nodes.js';
import { buildEdges } from './edges.js';
import { generateBackdoors } from './backdoors.js';
import { config } from './config.js';
import { log } from './utils.js';
import { bfsHopSimple } from './simulate-core.js'; // usato per calcolare distanze hop

// Helper: costruisce adjacency map { id: Set(neighborIds) }
function buildAdj(nodes, edges) {
  const adj = {};
  nodes.forEach(n => (adj[n.id] = new Set()));
  edges.forEach(e => {
    if (adj[e.from]) adj[e.from].add(e.to);
    if (adj[e.to]) adj[e.to].add(e.from);
  });
  return adj;
}

export function makeGraph(params = {}) {
  const regions = generateRegions();
  const nodes = distributeNodes(regions);

  // buildEdges si aspetta (nodes, regions, diagonalBiasPct)
  const diagBias = params.diagonalBiasPct ?? config.diagonalBiasPct;
  const baseEdges = buildEdges(nodes, regions, diagBias);

  const backdoorPct = params.backdoorPct ?? config.backdoorPct;
  const minLen = params.minLen ?? config.minLen;
  const maxLen = params.maxLen ?? config.maxLen;

  const backdoorResult = generateBackdoors(
    nodes,
    regions,
    baseEdges,
    backdoorPct,
    minLen,
    maxLen,
    { startRegion: config.START_REGION, goalRegion: config.GOAL_REGION }
  );

  if (backdoorResult.meta && backdoorResult.meta.failures?.length > 0) {
    console.warn('[MakeGraph] Backdoor failures:', backdoorResult.meta.failures);
  }

  const edges = [...baseEdges, ...backdoorResult.edges];

  // assegna start / goal
  const s = nearestInRegion(nodes, regions, config.START_REGION);
  if (s) s.type = 'start';
  const g = nearestInRegion(nodes, regions, config.GOAL_REGION);
  if (g) g.type = 'goal';

  return {
    meta: { total_nodes: config.TOTAL_NODES, regions: config.NUM_REGIONS, start_region: 'B1', goal_region: 'B3' },
    regions,
    nodes,
    edges,
    params: { ...params, backdoorMeta: backdoorResult.meta }
  };
}

export function pruneBackdoorsByHop(graph, minLen, maxLen) {
  const nodes = graph.nodes;
  const edges = graph.edges.slice();
  const adjNoBack = {};
  nodes.forEach(n => (adjNoBack[n.id] = new Set()));
  edges.forEach(e => {
    if (e.type === 'backdoor') return;
    adjNoBack[e.from].add(e.to);
    adjNoBack[e.to].add(e.from);
  });

  function bfsNoBack(a, b) {
    const q = [a];
    const dist = { [a]: 0 };
    while (q.length) {
      const v = q.shift();
      if (v === b) return dist[v];
      for (const nb of adjNoBack[v]) {
        if (dist[nb] === undefined) {
          dist[nb] = dist[v] + 1;
          q.push(nb);
        }
      }
    }
    return Infinity;
  }

  graph.edges = edges.filter(e => {
    if (e.type !== 'backdoor') return true;
    const hops = bfsNoBack(e.from, e.to);
    return hops >= minLen && hops <= maxLen;
  });
}

export function checkBackdoorValidity(graph, minLen, maxLen) {
  minLen = minLen ?? graph.params?.minLen ?? 2;
  maxLen = maxLen ?? graph.params?.maxLen ?? 999;

  const nodes = graph.nodes;
  const edges = graph.edges;
  const backdoors = edges.filter(e => e.type === 'backdoor');
  const failures = [];
  const total = backdoors.length;

  if (total === 0) failures.push('No backdoors generated');

  for (const e of backdoors) {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) failures.push('Missing node: ' + JSON.stringify(e));
    if (a?.region === config.START_REGION || b?.region === config.START_REGION)
      failures.push('Backdoor endpoint in start region: ' + e.from + '-' + e.to);
  }

  const rDist = r => {
    const rr = Math.floor(r / config.REG_COLS), rc = r % config.REG_COLS;
    const gr = Math.floor(config.GOAL_REGION / config.REG_COLS);
    return Math.abs(rr - gr) + Math.abs(rc - (config.GOAL_REGION % config.REG_COLS));
  };

  let forward = 0, lateral = 0;
  backdoors.forEach(e => {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (!a || !b) return;
    const da = rDist(a.region), db = rDist(b.region);
    da === db ? lateral++ : forward++;
  });

  const forwardPct = total ? Math.round((forward / total) * 100) : 0;
  const lateralPct = total ? Math.round((lateral / total) * 100) : 0;
  if (total && Math.abs(forwardPct - 50) > 10)
    failures.push(`Forward/Lateral split out of ±10%: forward ${forwardPct}% lateral ${lateralPct}%`);

  graph.params = graph.params || {};
  graph.params.backdoorValidation = { total, forward, lateral, forwardPct, lateralPct, failures };
  return failures.length === 0;
}

export async function generateAndValidate(params = {}, maxAttempts = 30) {
  const failures = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[GenerateAndValidate] Attempt ${attempt + 1}/${maxAttempts}`);
    const graph = makeGraph(params);
    pruneBackdoorsByHop(graph, params.minLen ?? config.minLen, params.maxLen ?? config.maxLen);
    const valid = checkBackdoorValidity(graph, params.minLen ?? config.minLen, params.maxLen ?? config.maxLen);
    if (valid) return { success: true, graph, last: { failures: [] } };
    failures.push(`Attempt ${attempt + 1}: ${graph.params.backdoorValidation.failures.join('; ')}`);
  }
  return { success: false, last: { failures }, graph: null };
}

export function logPercentDiagonal(graph, targetBiasPct) {
  const totalEdges = graph.edges.length;
  const diagonalEdges = graph.edges.filter(e => {
    const a = graph.nodes.find(n => n.id === e.from), b = graph.nodes.find(n => n.id === e.to);
    if (!a || !b) return false;
    const dx = Math.abs(a.x - b.x) > 5, dy = Math.abs(a.y - b.y) > 5;
    return dx && dy;
  }).length;
  const actualBiasPct = totalEdges ? Math.round((diagonalEdges / totalEdges) * 100) : 0;
  const msg = `Diagonal bias: ${actualBiasPct}% (target: ${targetBiasPct}%)`;
  console.log(msg);
  if (typeof log === 'function') log(msg);
}

/**
 * initPatrolsAndHighlight
 * - crea al massimo 1 pattuglia per regione
 * - preferisce nodi "sicuri" (≥2 hop dal start)
 * - evita start/goal come spawn
 */
export function initPatrolsAndHighlight(graph, patrolDepth = config.PATROL_DEPTH_DEFAULT) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.regions)) {
    console.warn('Graph non valido per inizializzare pattuglie, skip.');
    return;
  }

  const depth = patrolDepth ?? config.PATROL_DEPTH_DEFAULT;
  graph.patrols = graph.patrols || [];

  // ricava adj e distMap (dal start) una sola volta
  const adj = buildAdj(graph.nodes, graph.edges);
  const startNodeObj = graph.nodes.find(n => n.type === 'start');
  const startId = startNodeObj ? startNodeObj.id : null;
  const distMap = startId !== null ? bfsHopSimple(adj, startId) : {};

  // genera 1 pattuglia per regione (se possibile)
  for (const r of graph.regions) {
    const regionId = r.id;
    const candidates = graph.nodes.filter(n => n.region === regionId && n.type !== 'start' && n.type !== 'goal');
    if (candidates.length === 0) {
      // nessun nodo utilizzabile in questa regione
      continue;
    }

    // preferisci nodi >=2 hop dal start (o non raggiungibili)
    const safeCandidates = candidates.filter(n => {
      const d = distMap[n.id];
      return d === undefined || d >= 2;
    });

    const pool = safeCandidates.length ? safeCandidates : candidates;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // aggiungi pattuglia
    graph.patrols.push({
      id: `p${regionId}`,
      pos: picked.id,
      prev: null,
      region: regionId,
      perceptionDepth: depth
    });
  }

  log(`Inizializzate ${graph.patrols.length} pattuglie (depth=${depth})`);
  if (typeof window?.redraw === 'function') window.redraw();
}
