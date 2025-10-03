import { SIM_MAX_TURNS, PLAYBACK_DELAY, NUM_REGIONS } from './config.js';

let playbackIdx = 0;  // ← Fix: globale per condividere con draw

export function simulateTrace(graph) {
  const nodes = JSON.parse(JSON.stringify(graph.nodes));
  const edges = graph.edges.slice();
  const adj = {};
  nodes.forEach(n => adj[n.id] = new Set());
  edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });
  const start = nodes.find(n => n.type === 'start').id;
  const goal = nodes.find(n => n.type === 'goal').id;
  let patrols = [];
  for (let r = 0; r < NUM_REGIONS; r++) {
    const cand = nodes.filter(n => n.region === r).map(n => n.id);
    if (cand.length > 0) patrols.push({ pos: cand[Math.floor(Math.random() * cand.length)], intent: null, nextIntent: null, prev: null });
  }

  let alert = 1;
  let playerPos = start;
  const visited = new Set([start]);
  const trace = [];
  trace.push({ player: playerPos, patrols: patrols.map(p => ({ pos: p.pos, prev: p.prev })), alert });
  for (let t = 1; t <= SIM_MAX_TURNS; t++) {
    // Player move greedy towards goal while avoiding patrols
    const dToGoal = bfsHopSimple(adj, playerPos);
    const options = Array.from(adj[playerPos]);
    options.push(playerPos);

    const patrolPos = patrols.map(p => p.pos);

    function nearestPatrolHop(node) {
      const d = bfsHopSimple(adj, node);
      let m = Infinity;
      for (const ppos of patrolPos) if (d[ppos] !== undefined) m = Math.min(m, d[ppos]);
      return m;
    }

    let best = null, bestScore = -Infinity;
    for (const opt of options) {
      const h = (dToGoal[opt] === undefined) ? 999 : dToGoal[opt];
      const pDist = nearestPatrolHop(opt);
      const score = (pDist * 0.6) - (h * 1.0);
      if (score > bestScore) { bestScore = score; best = opt; }
    }

    playerPos = best;
    visited.add(playerPos);

    // Alert roll
    const r = Math.floor(Math.random() * 100) + 1;
    const prevAlert = alert;
    if (r > (100 - 10)) alert = Math.min(5, alert + 1);
    else if (r <= 5) alert = Math.max(1, alert - 1);

    // Spawn/despawn simplified
    if (alert > prevAlert) {
      for (let rg = 0; rg < NUM_REGIONS; rg++) {
        if (Math.random() < 0.12) {
          const distMap = bfsHopSimple(adj, playerPos);
          const cand = nodes.filter(n => n.region === rg && ((distMap[n.id] === undefined) || distMap[n.id] >= 2)).map(n => n.id);
          if (cand.length > 0) patrols.push({ pos: cand[Math.floor(Math.random() * cand.length)], intent: null, nextIntent: null, prev: null });
        }
      }
    }
    if (alert < prevAlert && patrols.length > 0) {
      const distMap = bfsHopSimple(adj, playerPos);
      let closestIdx = null, bestd = Infinity;
      for (let pi = 0; pi < patrols.length; pi++) {
        const dcur = distMap[patrols[pi].pos] === undefined ? 999 : distMap[patrols[pi].pos];
        if (dcur < bestd) { bestd = dcur; closestIdx = pi; }
      }
      if (closestIdx !== null) patrols.splice(closestIdx, 1);
    }

    // Move patrols naive
    for (const p of patrols) {
      p.prev = p.pos;
      const nb = Array.from(adj[p.pos]);
      if (nb.length > 0) p.pos = nb[Math.floor(Math.random() * nb.length)];
    }

    trace.push({ player: playerPos, patrols: patrols.map(pp => ({ pos: pp.pos, prev: pp.prev })), alert });
    if (patrols.some(pp => pp.pos === playerPos)) return { outcome: 'captured', turns: t, trace };
    if (playerPos === goal) return { outcome: 'victory', turns: t, trace };
  }
  return { outcome: 'timeout', turns: SIM_MAX_TURNS, trace };
}

export function bfsHopSimple(adj, start) {
  const q = [start];
  const dist = { [start]: 0 };
  while (q.length) {
    const v = q.shift();
    for (const nb of adj[v]) {
      if (dist[nb] === undefined) {
        dist[nb] = dist[v] + 1;
        q.push(nb);
      }
    }
  }
  return dist;
}

export function playTrace(playbackTrace, canvas, ctx, currentGraph, currentPlayerPos, playbackTimer) {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackIdx = 0;  // ← Fix: reset idx globale
  console.log('Playback started: trace length', playbackTrace.length, 'frames');  // Debug: conferma animazione
  const timer = setInterval(() => {
    playbackIdx++;
    console.log('Playback frame:', playbackIdx);  // Debug: vedi movimento frame per frame
    if (playbackIdx > playbackTrace.length) {
      clearInterval(timer);
      console.log('Playback ended');
      playbackIdx = 0;  // Reset per prossimo run
      return;
    }
    // Chiama draw con idx aggiornato – mostra player/movimenti/pattuglie
    draw(canvas, ctx, currentGraph, null, playbackTrace, playbackIdx);  // Passa null per static player
  }, PLAYBACK_DELAY);
  return timer;
}