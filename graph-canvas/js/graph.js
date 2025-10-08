// ===============================
// graph.js - Core Graph Builder
// ===============================

import { generateRegions } from './regions.js';
import { distributeNodes, nearestInRegion } from './nodes.js';
import { buildEdges } from './edges.js';
import { config } from './config.js';
import { log } from './utils.js';
import { generateBackdoors } from './backdoors.js'; 

export function makeGraph(params = {}) {
  const regions = generateRegions();
  const nodes = distributeNodes(regions);
  const baseEdges = buildEdges(nodes, regions, params.diagonalBiasPct || config.diagonalBiasPct);
  const backdoorResult = generateBackdoors(
    nodes,
    regions,
    baseEdges,
    params.backdoorPct || config.backdoorPct,
    params.minLen || config.minLen,
    params.maxLen || config.maxLen,
    { startRegion: config.START_REGION, goalRegion: config.GOAL_REGION }
  );

  if (backdoorResult.meta.failures.length > 0)
    console.warn('[MakeGraph] Backdoor failures:', backdoorResult.meta.failures);

  const edges = [...baseEdges, ...backdoorResult.edges];

  const s = nearestInRegion(nodes, regions, config.START_REGION); s.type = 'start';
  const g = nearestInRegion(nodes, regions, config.GOAL_REGION); g.type = 'goal';

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
    const gr = Math.floor(config.GOAL_REGION / config.REG_COLS), gc = config.GOAL_REGION % config.REG_COLS;
    return Math.abs(rr - gr) + Math.abs(rc - gc);
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

  graph.params.backdoorValidation = { total, forward, lateral, forwardPct, lateralPct, failures };
  return failures.length === 0;
}

export async function generateAndValidate(params, maxAttempts = 30) {
  const failures = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[GenerateAndValidate] Attempt ${attempt + 1}/${maxAttempts}`);
    const graph = makeGraph(params);
    pruneBackdoorsByHop(graph, params.minLen, params.maxLen);
    const valid = checkBackdoorValidity(graph, params.minLen, params.maxLen);
    if (valid) return { success: true, graph, last: { failures: [] } };
    failures.push(`Attempt ${attempt + 1}: ${graph.params.backdoorValidation.failures.join('; ')}`);
  }
  return { success: false, last: { failures }, graph: null };
}

export function logPercentDiagonal(graph, targetBiasPct) {
  const totalEdges = graph.edges.length;
  const diagonalEdges = graph.edges.filter(e => e.type === 'diagonal').length;
  const actualBiasPct = totalEdges ? Math.round((diagonalEdges / totalEdges) * 100) : 0;
  const msg = `Diagonal bias: ${actualBiasPct}% (target: ${targetBiasPct}%)`;
  console.log(msg);
  if (typeof log === 'function') log(msg);
}

export function initPatrolsAndHighlight(graph, patrolDepth = config.PATROL_DEPTH_DEFAULT) {
  if (!graph?.nodes?.length || !graph.edges?.length) {
    console.warn("Graph non valido per inizializzare le pattuglie (salto)");
    return;
  }

  const depth = patrolDepth || config.PATROL_DEPTH_DEFAULT;
  config.patrolDepth = depth;

  if (!graph.patrols) {
    graph.patrols = [];
    const regions = new Set(graph.nodes.map(n => n.region));
    regions.forEach(regionId => {
      const nodesInRegion = graph.nodes.filter(n => n.region === regionId);
      if (nodesInRegion.length) {
        const randomNode = nodesInRegion[Math.floor(Math.random() * nodesInRegion.length)];
        graph.patrols.push({
          id: `p${regionId}`,
          pos: randomNode.id,
          prev: null,
          region: regionId,
          perceptionDepth: depth
        });
      }
    });
  } else {
    graph.patrols.forEach(p => (p.perceptionDepth = depth));
  }

  log(`Inizializzate ${graph.patrols.length} pattuglie (depth=${depth})`);
  if (typeof window?.redraw === 'function') window.redraw();
}