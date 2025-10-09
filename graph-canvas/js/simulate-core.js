import { config } from './config.js';
import { updatePatrols } from './patrol-control.js';

export let gameState = {  // Nuovo: Stato condiviso (mutabile)
  alert: 1,  // Inizia 1, max 5
  god: 80,   // Countdown da 80
  patrolsCount: 0  // Calcolato da patrols.length
};

export function simulateTrace(graph) {
  // Reset stato per nuova sim
  gameState.alert = 1;
  gameState.god = 80;
  gameState.patrolsCount = graph.patrols?.length || 0;

  const nodes = JSON.parse(JSON.stringify(graph.nodes));
  const edges = graph.edges.slice();
  const adj = buildAdj(nodes, edges);
  const start = nodes.find(n => n.type === 'start').id;
  const goal = nodes.find(n => n.type === 'goal').id;

  let patrols = graph.patrols || [];
  console.log('Sim patrols init:', patrols.length, 'with depth', config.patrolDepth);

  let playerPos = start;
  const visited = new Set([start]);
  const trace = [];
  trace.push({ player: playerPos, patrols: serializePatrols(patrols), alert: gameState.alert, god: gameState.god, patrolsCount: gameState.patrolsCount });

  for (let t = 1; t <= config.SIM_MAX_TURNS; t++) {
    playerPos = movePlayer(playerPos, goal, patrols, adj, visited);
    gameState.god--;  // Fix: Decrement God per mossa

    // Fix: Detection/Alert change post-move (dal documento: +10% up, -5% down)
    const minDistToPatrol = Math.min(...patrols.map(p => bfsHopSimple(adj, playerPos)[p.pos] || 999));
    const perception = 1 + Math.ceil(gameState.alert / 2);
    if (minDistToPatrol <= perception && Math.random() < 0.10) {
      gameState.alert = Math.min(5, gameState.alert + 1);  // +10% up
      console.log(`Detection up: dist=${minDistToPatrol}, alert now ${gameState.alert}`);
    } else if (Math.random() < 0.05) {  // -5% down (prob bassa)
      gameState.alert = Math.max(1, gameState.alert - 1);
      console.log(`Alert down: now ${gameState.alert}`);
    }

    gameState.patrolsCount = patrols.length;  // Update count
    alert = gameState.alert;  // Sync locale
    updatePatrols(patrols, alert, playerPos, adj, nodes, visited);

    trace.push({ player: playerPos, patrols: serializePatrols(patrols), alert: gameState.alert, god: gameState.god, patrolsCount: gameState.patrolsCount });
    if (gameState.god <= 0) return { outcome: 'god depleted', turns: t, trace };  // Fix: Game over God=0
    if (patrols.some(p => p.pos === playerPos)) return { outcome: 'captured', turns: t, trace };
    if (playerPos === goal) return { outcome: 'victory', turns: t, trace };
  }
  return { outcome: 'timeout', turns: config.SIM_MAX_TURNS, trace };
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

export function buildAdj(nodes, edges) {
  const adj = {};
  nodes.forEach(n => adj[n.id] = new Set());
  edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });
  return adj;
}

function serializePatrols(patrols) {
  return patrols.map(p => ({ pos: p.pos, prev: p.prev, intent: p.intent, perceptionDepth: p.perceptionDepth }));
}

function movePlayer(playerPos, goal, patrols, adj, visited) {
  const dToGoal = bfsHopSimple(adj, playerPos);
  const options = Array.from(adj[playerPos] || []);  // Adiacenti
  options.push(playerPos);  // Opzione "stay" per stealth

  const patrolPos = patrols.map(p => p.pos);
  function nearestPatrolHop(node) {
    const d = bfsHopSimple(adj, node);
    let m = Infinity;
    for (const ppos of patrolPos) if (d[ppos] !== undefined) m = Math.min(m, d[ppos]);
    return m;
  }

  let best = null, bestScore = -Infinity;
  for (const opt of options) {
    const h = (dToGoal[opt] === undefined) ? 999 : dToGoal[opt];  // Dist a goal
    const pDist = nearestPatrolHop(opt);  // Dist media patrols
    const score = (pDist * 0.6) - (h * 1.0);  // Greedy: allontana patrols, avvicina goal
    if (score > bestScore) { bestScore = score; best = opt; }
  }

  const newPos = best;
  visited.add(newPos);  // Track esplorazione per metriche
  return newPos;
}

function updateAlert(alert) {
  const r = Math.floor(Math.random() * 100) + 1;
  if (r > 90) return Math.min(5, alert + 1);
  if (r <= 5) return Math.max(1, alert - 1);
  return alert;
}