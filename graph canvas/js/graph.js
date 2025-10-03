import { generateRegions } from './regions.js';
import { distributeNodes, nearestInRegion } from './nodes.js';
import { buildEdges } from './edges.js';
import { generateBackdoors } from './backdoors.js';  // ← Aggiunto import per backdoor
import { REG_COLS, GOAL_REGION, START_REGION, TOTAL_NODES, NUM_REGIONS } from './config.js';

export function makeGraph(params) {
  const regions = generateRegions();
  const nodes = distributeNodes(regions);

  // Genera baseEdges (intra MST + extra + inter) – senza backdoor
  const baseEdges = buildEdges(nodes, regions, params.diagonalBiasPct || 70);

  // Genera backdoor su baseEdges
  const backdoorResult = generateBackdoors(nodes, regions, baseEdges, params.backdoorPct, params.minLen, params.maxLen, {startRegion: START_REGION, goalRegion: GOAL_REGION});
  if (backdoorResult.meta.failures.length > 0) console.warn('[MakeGraph] Backdoor failures:', backdoorResult.meta.failures);

  // Combina tutto
  const edges = [...baseEdges, ...backdoorResult.edges];

  // Assegna start/goal (usa importata, non ridefinire)
  const s = nearestInRegion(nodes, regions, START_REGION);
  s.type = 'start';
  const g = nearestInRegion(nodes, regions, GOAL_REGION);
  g.type = 'goal';

  return {
    meta: { total_nodes: TOTAL_NODES, regions: NUM_REGIONS, start_region: 'B1', goal_region: 'B3' },
    regions,
    nodes,
    edges,
    params: { ...params, backdoorMeta: backdoorResult.meta }  // Aggiungi meta per debug (es. forwardPct)
  };
}

export function pruneBackdoorsByHop(graph, minLen, maxLen) {
  const nodes = graph.nodes;
  const edges = graph.edges.slice();
  const adjNoBack = {};
  nodes.forEach(n => adjNoBack[n.id] = new Set());
  edges.forEach(e => {
    if (e.type && e.type === 'backdoor') return;
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

  const filtered = [];
  for (const e of edges) {
    if (!(e.type && e.type === 'backdoor')) filtered.push(e);
    else {
      const hops = bfsNoBack(e.from, e.to);
      if (hops !== Infinity && hops >= minLen && hops <= maxLen) filtered.push(e);
    }
  }
  graph.edges = filtered;
}

export function checkBackdoorValidity(graph, minLen, maxLen) {
  const nodes = graph.nodes;
  const edges = graph.edges;
  const backdoors = edges.filter(e => e.type && e.type === 'backdoor');
  const failures = [];
  const total = backdoors.length;  // Definisci total qui

  if (total === 0) failures.push('No backdoors generated');

  // Check endpoint in start region
  for (const e of backdoors) {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    if (a.region === START_REGION || b.region === START_REGION) {
      failures.push('Backdoor endpoint in start region: ' + e.from + '-' + e.to);
    }
  }

  // Calcola forward/lateral
  function rDist(r) {
    const rr = Math.floor(r / REG_COLS), rc = r % REG_COLS;
    const gr = Math.floor(GOAL_REGION / REG_COLS), gc = GOAL_REGION % REG_COLS;
    return Math.abs(rr - gr) + Math.abs(rc - gc);
  }
  let forward = 0, lateral = 0;
  backdoors.forEach(e => {
    const a = nodes.find(n => n.id === e.from);
    const b = nodes.find(n => n.id === e.to);
    const da = rDist(a.region), db = rDist(b.region);
    if (da === db) lateral++;
    else forward++;
  });
  const forwardPct = total ? Math.round(forward / total * 100) : 0;
  const lateralPct = total ? Math.round(lateral / total * 100) : 0;
  if (total > 0 && Math.abs(forwardPct - 50) > 10) {
    failures.push('Forward/Lateral split out of ±10%: forward ' + forwardPct + '% lateral ' + lateralPct + '%');
  }

  // Hop length check (ignora backdoor per BFS)
  const adjNoBack = {};
  nodes.forEach(n => adjNoBack[n.id] = new Set());
  edges.forEach(e => {
    if (e.type && e.type === 'backdoor') return;
    adjNoBack[e.from].add(e.to);
    adjNoBack[e.to].add(e.from);
  });
  function bfsNoBack2(a, b) {
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
  const hopsList = [];  // Per calcolare avgHops dopo
  for (const e of backdoors) {
    const hops = bfsNoBack2(e.from, e.to);
    hopsList.push(hops);  // Raccogli per avg
    if (hops === Infinity) failures.push('Backdoor disconnected: ' + e.from + '-' + e.to);
    if (hops < minLen) failures.push('Backdoor shorter than min: hops=' + hops + ' ' + e.from + '-' + e.to);
    if (hops > maxLen) failures.push('Backdoor longer than max: hops=' + hops + ' ' + e.from + '-' + e.to);
  }

  // Calcola score (fuori dal loop, alla fine)
  const avgHops = hopsList.reduce((sum, h) => sum + (h === Infinity ? 0 : h), 0) / total || 0;
  const variety = new Set(backdoors.map(e => [e.from.region, e.to.region].sort().join('-'))).size;
  const score = (total * 0.4) + (variety * 0.3) + ((avgHops >= minLen && avgHops <= maxLen) ? 0.3 : 0);

  return {
    total,
    forward,
    lateral,
    forwardPct,
    lateralPct,
    failures,
    avgHops: avgHops.toFixed(2),  // Aggiunto per debug
    variety,
    score: score.toFixed(2)  // Score finale 0-1
  };  // ← Fix: solo un return, rimuovi duplicato e 'edges' non definito
}