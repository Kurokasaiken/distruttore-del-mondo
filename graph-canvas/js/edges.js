import { config } from './config.js';

export function buildEdges(nodes, regions, diagonalBiasPct = config.diagonalBiasPct, degree3Pct = config.degree3Pct, degree4Pct = config.degree4Pct, interRegionEdges = config.INTER_REGION_EDGES) {
  const coord = {}; nodes.forEach(n => coord[n.id] = n);
  const edgesMap = {};

  function addEdge(a, b, type) {
    if (a === b) return;
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (!edgesMap[key]) {
      // Helper interno: Calcola se è diagonale
      function isDiagonal(u, v) {
        const dx = Math.abs(coord[u].x - coord[v].x) > 5;
        const dy = Math.abs(coord[u].y - coord[v].y) > 5;
        return dx && dy;
      }
      const finalType = isDiagonal(a, b) ? 'diagonal' : (type || 'intra');
      edgesMap[key] = { from: Math.min(a, b), to: Math.max(a, b), type: finalType };
    }
  }

  function regionRow(region) { return Math.floor(region / config.REG_COLS); }

  // Helper: Calcola distanza con penalità dinamica basata su %
  function diagonalDist(u, v, biasPct = diagonalBiasPct) {
    const dx = Math.abs(coord[u].x - coord[v].x);
    const dy = Math.abs(coord[u].y - coord[v].y);
    const dist = Math.hypot(dx, dy);
    const isDiagonal = dx > 5 && dy > 5;
    const penalty = 1 + (biasPct / 100) * 0.5;
    return isDiagonal ? dist : dist * penalty;
  }

  // Group by region
  const byRegion = {}; nodes.forEach(n => { byRegion[n.region] = byRegion[n.region] || []; byRegion[n.region].push(n); });

  // MST per region
  for (const rid in byRegion) {
    const list = byRegion[rid];
    if (!list || list.length === 0) continue;
    const used = new Set();
    const rem = new Set(list.map(x => x.id));
    const first = list[0].id;
    used.add(first); rem.delete(first);
    while (rem.size > 0) {
      let bestD = Infinity, ba = null, bb = null;
      used.forEach(u => {
        rem.forEach(v => {
          const d = diagonalDist(u, v);
          if (d < bestD) { bestD = d; ba = u; bb = v; }
        });
      });
      if (ba !== null) {
        addEdge(ba, bb, 'intra');
        used.add(bb); rem.delete(bb);
      } else break;
    }
  }

  // Local extras
  const k_extra = config.K_EXTRA;
  nodes.forEach(n => {
    const same = nodes.filter(m => m.region === n.region && m.id !== n.id);
    same.sort((a, b) => diagonalDist(n.id, a.id) - diagonalDist(n.id, b.id));
    for (let i = 0; i < Math.min(k_extra, same.length); i++) addEdge(n.id, same[i].id, 'intra');
  });

  // Inter-region adjacencies
  const adjPairs = [];
  for (let r = 0; r < config.NUM_REGIONS; r++) {
    const rr = Math.floor(r / config.REG_COLS), rc = r % config.REG_COLS;
    [[0, 1], [1, 0]].forEach(d => {
      const nr = rr + d[0], nc = rc + d[1];
      if (nr >= 0 && nr < config.REG_ROWS && nc >= 0 && nc < config.REG_COLS) adjPairs.push([r, nr * config.REG_COLS + nc]);
    });
  }

  console.log(`[BuildEdges] Creating ${interRegionEdges} edges between ${adjPairs.length} adjacent region pairs`);

  let interRegionEdgesCreated = 0;
  
  // Per ogni coppia di regioni adiacenti
  adjPairs.forEach(pair => {
    const [a, b] = pair;
    const A = nodes.filter(n => n.region === a);
    const B = nodes.filter(n => n.region === b);
    if (A.length === 0 || B.length === 0) return;
    
    // Set per tenere traccia dei nodi già utilizzati per connessioni tra queste regioni
    const usedA = new Set();
    const usedB = new Set();
    
    // Genera tutte le possibili coppie di nodi tra le due regioni
    const pairs = [];
    A.forEach(na => B.forEach(nb => pairs.push({ a: na.id, b: nb.id, d: diagonalDist(na.id, nb.id) })));
    pairs.sort((u, v) => u.d - v.d);
    
    // Crea 'interRegionEdges' connessioni (o meno se non ci sono abbastanza coppie)
    let edgesForThisPair = 0;
    for (let i = 0; i < pairs.length && edgesForThisPair < interRegionEdges; i++) {
      const nodeA = pairs[i].a;
      const nodeB = pairs[i].b;
      
      // Verifica che entrambi i nodi non siano già stati usati per una connessione
      if (!usedA.has(nodeA) && !usedB.has(nodeB)) {
        addEdge(nodeA, nodeB, 'inter');
        usedA.add(nodeA);
        usedB.add(nodeB);
        edgesForThisPair++;
        interRegionEdgesCreated++;
      }
    }
    
    console.log(`[BuildEdges] Created ${edgesForThisPair} edges between regions ${a} and ${b}`);
  });

  console.log(`[BuildEdges] Created total of ${interRegionEdgesCreated} inter-region edges`);

  // Restituisci baseEdges iniziale
  let baseEdges = Object.keys(edgesMap).map(k => edgesMap[k]);

  // Enforce degrees post-generazione (integrata qui, dentro buildEdges)
  function enforceDegrees(edges, degree3Pct, degree4Pct) {
    const totalNodes = nodes.length;
    const targetDegree3 = Math.round(totalNodes * (degree3Pct / 100));
    const targetDegree4 = Math.round(totalNodes * (degree4Pct / 100));
    const adj = {}; nodes.forEach(n => adj[n.id] = new Set());
    edges.forEach(e => {
      adj[e.from].add(e.to);
      adj[e.to].add(e.from);
    });

    // Calcola current degrees
    const degrees = nodes.map(n => adj[n.id].size);

    // Step 1: Aumenta a degree 3/4 i nodi sotto (aggiungi nearest non-esistenti)
    let added3 = 0, added4 = 0;
    for (let i = 0; i < nodes.length && (added3 < targetDegree3 || added4 < targetDegree4); i++) {
      const deg = degrees[i];
      if (deg >= 4) continue;  // Già alto
      const n = nodes[i].id;
      const candidates = nodes.filter(m => m.id !== n && !adj[n].has(m.id) && m.region === nodes[i].region);  // Intra solo
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => diagonalDist(n, a.id) - diagonalDist(n, b.id));
      const newEdge = { from: Math.min(n, candidates[0].id), to: Math.max(n, candidates[0].id), type: 'intra' };
      edges.push(newEdge);
      adj[n].add(candidates[0].id);
      adj[candidates[0].id].add(n);
      degrees[i]++; 
      const candidateIndex = candidates[0].id - nodes[0].id;  // Fix: Calcola index corretto (assumi ids sequenziali da 0)
      if (candidateIndex >= 0 && candidateIndex < degrees.length) degrees[candidateIndex]++;  // Fix: Update sicuro
      if (deg + 1 === 3) added3++; else if (deg + 1 === 4) added4++;
    }

    // Step 2: Riduci >4 rimuovendo longest non-MST
    for (let i = 0; i < nodes.length; i++) {
      if (degrees[i] <= 4) continue;
      const n = nodes[i].id;
      let longestEdge = null, maxLen = 0;
      adj[n].forEach(to => {
        const len = Math.hypot(coord[n].x - coord[to].x, coord[n].y - coord[to].y);
        if (len > maxLen) { maxLen = len; longestEdge = { from: Math.min(n, to), to: Math.max(n, to) }; }
      });
      if (longestEdge) {
        edges = edges.filter(e => !(e.from === longestEdge.from && e.to === longestEdge.to));
        adj[n].delete(longestEdge.to);
        adj[longestEdge.to].delete(n);
        degrees[i]--;
        const toIndex = longestEdge.to - nodes[0].id;  // Fix: Calcola index corretto
        if (toIndex >= 0 && toIndex < degrees.length) degrees[toIndex]--;  // Fix: Update sicuro
      }
    }

    console.log(`[EnforceDegrees] Target 3: ${targetDegree3} (added ${added3}), 4: ${targetDegree4} (added ${added4})`);
    return edges;
  }

  // Alla fine di buildEdges: Applica enforce (ora dentro funzione, no return illegale)
  baseEdges = enforceDegrees(baseEdges, degree3Pct, degree4Pct);

  // Debug % diagonali
  const diagCount = baseEdges.filter(e => e.type === 'diagonal').length;
  const pctDiag = (diagCount / baseEdges.length * 100).toFixed(0);
  console.log(`[BuildEdges] Base edges: ${baseEdges.length}, diagonali ~${pctDiag}% (bias: ${diagonalBiasPct}%)`);

  return baseEdges;
}