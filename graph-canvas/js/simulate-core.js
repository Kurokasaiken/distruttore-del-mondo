import { config } from './config.js';
import { updatePatrols } from './patrol-control.js';

export let gameState = {  // Stato condiviso
  alert: 1,
  god: 80,
  patrolsCount: 0
};

export function simulateTrace(graph) {
  // Reset stato
  gameState.alert = 1;
  gameState.god = 80;
  gameState.patrolsCount = graph.patrols?.length || 0;
  console.log('Reset gameState:', gameState);

  const nodes = JSON.parse(JSON.stringify(graph.nodes));
  const edges = graph.edges.slice();
  const adj = buildAdj(nodes, edges);
  const start = nodes.find(n => n.type === 'start').id;
  const goal = nodes.find(n => n.type === 'goal').id;

  let patrols = [...graph.patrols || []];  // Copy per mutabilità
  console.log('Sim patrols init:', patrols.length, 'with depth', config.patrolDepth);

  let playerPos = start;
  const visited = new Set([start]);
  const trace = [];  // Array esplicito

  // Stato iniziale
  trace.push({ 
    phase: 'initial', 
    player: playerPos, 
    patrols: serializePatrols(patrols), 
    alert: gameState.alert, 
    god: gameState.god, 
    patrolsCount: gameState.patrolsCount 
  });
  console.log('Initial trace push, length:', trace.length);

  for (let t = 1; t <= config.SIM_MAX_TURNS; t++) {
    // Phase 1: Intenzione pattuglie
    trace.push({ 
      phase: 'patrol_intent', 
      player: playerPos, 
      patrols: serializePatrols(patrols),
      alert: gameState.alert, 
      god: gameState.god, 
      patrolsCount: gameState.patrolsCount 
    });

    // Phase 2: Movimento giocatore
    const oldPlayerPos = playerPos;
    playerPos = movePlayer(playerPos, goal, patrols, adj, visited);
    gameState.god = Math.max(0, gameState.god - 1);
    trace.push({ 
      phase: 'player_move', 
      player: playerPos, 
      patrols: serializePatrols(patrols),
      alert: gameState.alert, 
      god: gameState.god, 
      patrolsCount: gameState.patrolsCount 
    });
    console.log(`Turn ${t} player moved from ${oldPlayerPos} to ${playerPos} (old ≠ new? ${oldPlayerPos !== playerPos})`);

    // Phase 3: Trigger alert
    const minDistToPatrol = Math.min(...patrols.map(p => bfsHopSimple(adj, playerPos)[p.pos] || 999));
    const perception = 1 + Math.ceil(gameState.alert / 2);
    let alertChanged = false;
    if (minDistToPatrol <= perception && Math.random() < 0.10) {
      gameState.alert = Math.min(5, gameState.alert + 1);
      alertChanged = true;
      console.log(`[Sim] Alert up to ${gameState.alert} (dist ${minDistToPatrol})`);
    } else if (Math.random() < 0.05) {
      gameState.alert = Math.max(1, gameState.alert - 1);
      alertChanged = true;
      console.log(`[Sim] Alert down to ${gameState.alert}`);
    }
    trace.push({ 
      phase: 'alert_trigger', 
      player: playerPos, 
      patrols: serializePatrols(patrols),
      alert: gameState.alert, 
      god: gameState.god, 
      patrolsCount: gameState.patrolsCount,
      alertChanged 
    });

    // Phase 4: Movimento pattuglie
    updatePatrols(patrols, gameState.alert, playerPos, adj, nodes, visited);
    gameState.patrolsCount = patrols.length;  // Sync count
    trace.push({ 
      phase: 'patrol_move', 
      player: playerPos, 
      patrols: serializePatrols(patrols),
      alert: gameState.alert, 
      god: gameState.god, 
      patrolsCount: gameState.patrolsCount 
    });
    console.log(`Turn ${t} patrols moved, count now ${gameState.patrolsCount}`);

    // Phase 5: Nuova intenzione (già in updatePatrols)
    trace.push({ 
      phase: 'patrol_next_intent', 
      player: playerPos, 
      patrols: serializePatrols(patrols),
      alert: gameState.alert, 
      god: gameState.god, 
      patrolsCount: gameState.patrolsCount 
    });
    console.log(`Turn ${t} trace length now ${trace.length}`);

    // Check end
    if (gameState.god <= 0) return { outcome: 'god depleted', turns: t, trace };
    if (patrols.some(p => p.pos === playerPos)) return { outcome: 'captured', turns: t, trace };
    if (playerPos === goal) return { outcome: 'victory', turns: t, trace };
  }
  console.log('Sim ended: timeout, trace length', trace.length);
  return { outcome: 'timeout', turns: config.SIM_MAX_TURNS, trace };
}

// Fix per movePlayer (penalizza stay, peso goal più alto)
function movePlayer(playerPos, goal, patrols, adj, visited) {
  const dToGoal = bfsHopSimple(adj, playerPos);
  const options = Array.from(adj[playerPos] || []);  // Adiacenti
  options.push(playerPos);  // Stay

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
    let score = (pDist * 0.6) - (h * 1.5);  // Fix: Peso goal 1.5 per forzare move
    if (opt === playerPos && options.length > 1) score -= 3;  // Fix: Penalizza stay se ha adiacenti
    if (score > bestScore) { bestScore = score; best = opt; }
  }

  const newPos = best;
  visited.add(newPos);
  console.log('Move score:', bestScore, 'to', newPos, 'options:', options);  // Debug
  return newPos;
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

function updateAlert(alert) {
  const r = Math.floor(Math.random() * 100) + 1;
  if (r > 90) return Math.min(5, alert + 1);
  if (r <= 5) return Math.max(1, alert - 1);
  return alert;
}