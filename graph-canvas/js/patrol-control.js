// js/patrol-control.js (Logica Pattuglie e Controllo)
import { config } from './config.js';
import { bfsHopSimple } from './simulate-core.js';

// Helper condiviso: Calcola dirVec e cone nodes
export function computeDirVecAndCone(graph, patrol, adj) {
  const pos = patrol.pos || patrol.currentNode;
  const nextMove = patrol.intent || patrol.nextIntent || null;
  const prev = patrol.prev;

  let dirVec = { x: 0, y: -1 };  // Default up
  if (nextMove) {
    const nextNode = graph.nodes.find(n => n.id === nextMove);
    const centerNode = graph.nodes.find(n => n.id === pos);
    if (nextNode && centerNode) {
      dirVec.x = nextNode.x - centerNode.x;
      dirVec.y = nextNode.y - centerNode.y;
      const m = Math.hypot(dirVec.x, dirVec.y) || 1;
      dirVec.x /= m;
      dirVec.y /= m;
    }
  } else if (prev !== null) {
    const prevNode = graph.nodes.find(n => n.id === prev);
    const centerNode = graph.nodes.find(n => n.id === pos);
    if (prevNode && centerNode) {
      dirVec.x = centerNode.x - prevNode.x;
      dirVec.y = centerNode.y - prevNode.y;
      const m = Math.hypot(dirVec.x, dirVec.y) || 1;
      dirVec.x /= m;
      dirVec.y /= m;
    }
  } else {
    const neigh = Array.from(adj[pos] || []);
    if (neigh.length > 0) {
      const nn = graph.nodes.find(n => n.id === neigh[0]);
      const centerNode = graph.nodes.find(n => n.id === pos);
      if (nn && centerNode) {
        dirVec.x = nn.x - centerNode.x;
        dirVec.y = nn.y - centerNode.y;
        const m = Math.hypot(dirVec.x, dirVec.y) || 1;
        dirVec.x /= m;
        dirVec.y /= m;
      }
    }
  }

  // Calcola cone nodes con BFS filtrato
  const centerNode = graph.nodes.find(n => n.id === pos);
  const visited = new Set([pos]);
  const q = [{ id: pos, dep: 0 }];
  const coneNodes = [];
  while (q.length) {
    const { id, dep } = q.shift();
    if (dep > config.patrolDepth) continue;
    const node = graph.nodes.find(n => n.id === id);
    if (!node || !centerNode) continue;
    const vec = { x: node.x - centerNode.x, y: node.y - centerNode.y };
    const mag = Math.hypot(vec.x, vec.y) || 1;
    const dot = (vec.x * dirVec.x + vec.y * dirVec.y) / mag;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    if (dep === 0 || ang <= config.coneAngle / 2) {
      coneNodes.push(id);
    }

    for (const nb of adj[id] || []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        q.push({ id: nb, dep: dep + 1 });
      }
    }
  }

  return { dirVec, coneNodes };
}

export function updatePatrols(patrols, alert, playerPos, adj, nodes, visited) {
  const prevAlert = alert - 1;  // Assume previous

  // Spawn if alert up (Fix: Prob 0.12 per rg, nodo dist ≥2)
  if (alert > prevAlert) {
    for (let rg = 0; rg < config.NUM_REGIONS; rg++) {
      if (Math.random() < 0.12) {
        const distMap = bfsHopSimple(adj, playerPos);
        const cand = nodes.filter(n => n.region === rg && (distMap[n.id] === undefined || distMap[n.id] >= 2)).map(n => n.id);  // Fix: Dist ≥2 dal player
        if (cand.length > 0) {
          const pos = cand[Math.floor(Math.random() * cand.length)];  // Random in cand
          const nb = Array.from(adj[pos] || []);
          const intent = nb.length > 0 ? nb[Math.floor(Math.random() * nb.length)] : null;
          patrols.push({
            pos,
            intent,
            prev: null,
            perceptionDepth: config.patrolDepth
          });
        }
      }
    }
    console.log('[PatrolControl] Spawned, total patrols:', patrols.length);
  }

  // Despawn if alert down (invariato)
  if (alert < prevAlert && patrols.length > 0) {
    const distMap = bfsHopSimple(adj, playerPos);
    let closestIdx = null, bestd = Infinity;
    for (let pi = 0; pi < patrols.length; pi++) {
      const dcur = distMap[patrols[pi].pos] === undefined ? 999 : distMap[patrols[pi].pos];
      if (dcur < bestd) { bestd = dcur; closestIdx = pi; }
    }
    if (closestIdx !== null) {
      patrols.splice(closestIdx, 1);
      console.log('[PatrolControl] Despawned, total patrols:', patrols.length);
    }
  }

  // Move patrols (invariato)
  for (const p of patrols) {
    p.prev = p.pos;
    if (p.intent) {
      p.pos = p.intent;
    } else {
      const nb = Array.from(adj[p.pos] || []);
      if (nb.length > 0) p.pos = nb[Math.floor(Math.random() * nb.length)];
    }
    const nb = Array.from(adj[p.pos] || []);
    p.intent = nb.length > 0 ? nb[Math.floor(Math.random() * nb.length)] : null;
  }
  console.log('[PatrolControl] Moved patrols, new intents generated');
}

export function markPatrolControl(patrols, graph, depthOverride) {
  if (!patrols || patrols.length === 0) return { controlledNodes: new Map(), intentNodes: new Set() };
  const adj = {};
  graph.nodes.forEach(n => adj[n.id] = new Set());
  graph.edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });

  const controlledNodes = new Map();
  const intentNodes = new Set();
  let totalConeNodes = 0;

  patrols.forEach(patrol => {
    const { coneNodes } = computeDirVecAndCone(graph, patrol, adj);
    const nextMove = patrol.intent || patrol.nextIntent || null;
    if (nextMove) intentNodes.add(nextMove);

    coneNodes.forEach(id => controlledNodes.set(id, (controlledNodes.get(id) || 0) + 1));
    totalConeNodes += coneNodes.length;
  });

  console.log('[PatrolControl] Mark: controlled', controlledNodes.size, 'intent', intentNodes.size, 'depth', depthOverride || config.patrolDepth, 'total cone nodes', totalConeNodes);
  return {
    controlledNodes,
    intentNodes
  };
}