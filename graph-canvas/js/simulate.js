export { markPatrolControl } from './patrol-control.js';
export { playTrace } from './playback.js';

export { bfsHopSimple } from './simulate-core.js';

/**
 * Simulazione intelligente: il giocatore cerca di raggiungere la Tower evitando sia le pattuglie che le aree di percezione.
 * - Evita nodi controllati dalle pattuglie (perception cone)
 * - Preferisce percorsi più lunghi se più sicuri
 * - Se non ci sono mosse sicure, minimizza il rischio
 */
export function simulateTrace(graph) {
  if (!graph || !graph.nodes || !graph.edges) return null;
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

  // Crea pattuglie (una per regione)
  let patrols = [];
  for (let r = 0; r < graph.meta.regions; r++) {
    const cand = nodes.filter(n => n.region === r).map(n => n.id);
    if (cand.length > 0) patrols.push({ pos: cand[Math.floor(Math.random() * cand.length)], prev: null });
  }

  let alert = 1;
  let playerPos = start;
  const trace = [];
  trace.push({ player: playerPos, patrols: patrols.map(p => ({ pos: p.pos, prev: p.prev })), alert });

  // Helper: calcola nodi controllati dalle pattuglie (perception cone)
  function getControlledNodes(patrols, depth = graph.params?.CONE_DEPTH || 2, angle = graph.params?.CONE_ANGLE || 80) {
    const controlled = new Set();
    patrols.forEach(p => {
      const center = nodes.find(n => n.id === p.pos);
      if (!center) return;
      let dirVec = { x: 0, y: -1 };
      if (p.prev !== null) {
        const pn = nodes.find(n => n.id === p.prev);
        if (pn) {
          dirVec.x = center.x - pn.x;
          dirVec.y = center.y - pn.y;
          const m = Math.hypot(dirVec.x, dirVec.y) || 1;
          dirVec.x /= m;
          dirVec.y /= m;
        }
      }
      const visited = new Set([p.pos]);
      const q = [{ id: p.pos, depth: 0 }];
      while (q.length) {
        const it = q.shift();
        const node = nodes.find(n => n.id === it.id);
        if (!node) continue;
        const vec = { x: node.x - center.x, y: node.y - center.y };
        const mag = Math.hypot(vec.x, vec.y) || 1;
        const dot = (vec.x * dirVec.x + vec.y * dirVec.y) / mag;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        if (ang <= angle / 2) controlled.add(node.id);
        if (it.depth < depth) {
          for (const nb of Array.from(adj[it.id]))
            if (!visited.has(nb)) {
              visited.add(nb);
              q.push({ id: nb, depth: it.depth + 1 });
            }
        }
      }
    });
    return controlled;
  }

  // Helper: preferisci avanzamento orizzontale verso la Tower
  function horizontalScore(fromNode, toNode, goalNode) {
    // Favorisci movimento orizzontale verso la colonna del goal
    const dx = Math.abs(toNode.x - goalNode.x);
    const dy = Math.abs(toNode.y - goalNode.y);
    // Penalizza movimenti verticali
    return dx - dy * 0.7;
  }

  for (let t = 1; t <= 150; t++) {
    // Calcola nodi controllati dalle pattuglie
    const controlledNodes = getControlledNodes(patrols);

    // Opzioni di movimento (incluso stare fermo)
    const options = Array.from(adj[playerPos]);
    options.push(playerPos);

    // Filtra opzioni sicure (non controllate e non occupate da pattuglie)
    const patrolPositions = patrols.map(p => p.pos);
    const safeOptions = options.filter(opt => !controlledNodes.has(opt) && !patrolPositions.includes(opt));

    let best = null;
    const dToGoal = bfsHop(adj, playerPos);
    const playerNode = nodes.find(n => n.id === playerPos);
    const goalNode = nodes.find(n => n.id === goal);

    // Scegli la mossa che avanza orizzontalmente verso la Tower, penalizzando lo stare fermi e movimenti verticali
    function optionScore(opt) {
      const node = nodes.find(n => n.id === opt);
      if (!node) return Infinity;
      const h = dToGoal[opt] !== undefined ? dToGoal[opt] : 999;
      const penalty = (opt === playerPos) ? 10 : 0;
      // Favorisci avanzamento orizzontale verso la colonna del goal
      const horiz = horizontalScore(playerNode, node, goalNode);
      return h + penalty + horiz * 0.7;
    }

    if (safeOptions.length > 0) {
      best = safeOptions.reduce((acc, opt) => {
        const score = optionScore(opt);
        return score < acc.score ? { opt, score } : acc;
      }, { opt: safeOptions[0], score: optionScore(safeOptions[0]) }).opt;
    } else {
      best = options.reduce((acc, opt) => {
        const score = optionScore(opt);
        return score < acc.score ? { opt, score } : acc;
      }, { opt: options[0], score: optionScore(options[0]) }).opt;
    }
    playerPos = best;

    // Evento randomico ad ogni mossa del giocatore
    const roll = Math.floor(Math.random() * 100) + 1;
    const prevAlert = alert;
    if (roll >= 1 && roll <= 10) {
      alert = Math.min(5, alert + 1);
      onAlertIncrease({ player: playerPos, patrols, alert });
    } else if (roll >= 95 && roll <= 100) {
      alert = Math.max(1, alert - 1);
      onAlertDecrease({ player: playerPos, patrols, alert });
    }

    // spawn/despawn
    if (alert > prevAlert) {
      for (let rg = 0; rg < graph.meta.regions; rg++) {
        // Fix: NON spawnare pattuglie entro 2 nodi dal giocatore
        const distMap = bfsHop(adj, playerPos);
        const cand = nodes.filter(n =>
          n.region === rg &&
          ((distMap[n.id] === undefined) || distMap[n.id] >= 2)
        ).map(n => n.id);
        if (cand.length > 0 && Math.random() < 0.12) {
          patrols.push({ pos: cand[Math.floor(Math.random() * cand.length)], prev: null });
        }
      }
    }
    if (alert < prevAlert && patrols.length > 0) {
      const distMap = bfsHop(adj, playerPos);
      let closestIdx = null, bestd = Infinity;
      for (let pi = 0; pi < patrols.length; pi++) {
        const dcur = distMap[patrols[pi].pos] === undefined ? 999 : distMap[patrols[pi].pos];
        if (dcur < bestd) { bestd = dcur; closestIdx = pi; }
      }
      if (closestIdx !== null) patrols.splice(closestIdx, 1);
    }

    // move patrols random
    for (const p of patrols) {
      p.prev = p.pos;
      const nb = Array.from(adj[p.pos]);
      if (nb.length > 0) p.pos = nb[Math.floor(Math.random() * nb.length)];
    }

    trace.push({ player: playerPos, patrols: patrols.map(p => ({ pos: p.pos, prev: p.prev })), alert });

    // Condizioni di fine
    if (patrols.some(pp => pp.pos === playerPos)) return { outcome: 'captured', turns: t, trace };
    if (controlledNodes.has(playerPos)) return { outcome: 'captured', turns: t, trace };
    if (playerPos === goal) return { outcome: 'victory', turns: t, trace };
  }
  return { outcome: 'timeout', turns: 150, trace };
}

// Funzione per gestire l'aumento dell'alert
function onAlertIncrease(state) {
  // Esempio: logga, aggiungi pattuglie, cambia colore, ecc.
  // Qui puoi aggiungere la tua logica custom
  // state: { player, patrols, alert, ... }
  // Ad esempio:
  // console.log('Alert aumentato a', state.alert);
  // Potresti aggiungere una pattuglia extra, cambiare strategia, ecc.
}

// Funzione per gestire la diminuzione dell'alert
function onAlertDecrease(state) {
  // Esempio: logga, rimuovi pattuglie, cambia colore, ecc.
  // Qui puoi aggiungere la tua logica custom
  // state: { player, patrols, alert, ... }
  // Ad esempio:
  // console.log('Alert diminuito a', state.alert);
  // Potresti rimuovere una pattuglia, cambiare strategia, ecc.
}

// Helper BFS
function bfsHop(adj, start) {
  const q = [start];
  const dist = {};
  dist[start] = 0;
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