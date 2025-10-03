import { REG_COLS, START_REGION, GOAL_REGION, NUM_REGIONS, REG_ROWS } from './config.js';

export function buildEdges(nodes, regions, diagonalBiasPct = 70) {
  // Rimuovi minLen/maxLen – non usati qui (gestiti da generateBackdoors)
  const coord = {}; nodes.forEach(n => coord[n.id] = n);
  const edgesMap = {};

  function addEdge(a, b, type) {
    if (a === b) return;  // Fix: rimuovi 'return;' errato
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (!edgesMap[key]) edgesMap[key] = { from: Math.min(a, b), to: Math.max(a, b), type: type || 'intra' };
  }

  function regionRow(region) { return Math.floor(region / REG_COLS); }

  // Helper: Calcola distanza con penalità dinamica basata su %
  function diagonalDist(u, v, biasPct = diagonalBiasPct) {
    const dx = Math.abs(coord[u].x - coord[v].x);
    const dy = Math.abs(coord[u].y - coord[v].y);
    const dist = Math.hypot(dx, dy);
    const isDiagonal = dx > 5 && dy > 5;  // Tolleranza per "vero" diagonale
    const penalty = 1 + (biasPct / 100) * 0.5;  // Es: 70% → 1.35x
    return isDiagonal ? dist : dist * penalty;
  }

  // Group by region
  const byRegion = {}; nodes.forEach(n => { byRegion[n.region] = byRegion[n.region] || []; byRegion[n.region].push(n); });

  // MST per region (favorisce diagonali con dist penalizzata)
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

  // Local extras (favorisce diagonali, sort con dist penalizzata)
  const k_extra = 2;
  nodes.forEach(n => {
    const same = nodes.filter(m => m.region === n.region && m.id !== n.id);
    same.sort((a, b) => diagonalDist(n.id, a.id) - diagonalDist(n.id, b.id));
    for (let i = 0; i < Math.min(k_extra, same.length); i++) addEdge(n.id, same[i].id, 'intra');
  });

  // Inter-region adjacencies (favorisce diagonali tra regioni adiacenti)
  const adjPairs = [];
  for (let r = 0; r < NUM_REGIONS; r++) {
    const rr = Math.floor(r / REG_COLS), rc = r % REG_COLS;
    [[0, 1], [1, 0]].forEach(d => {
      const nr = rr + d[0], nc = rc + d[1];
      if (nr >= 0 && nr < REG_ROWS && nc >= 0 && nc < REG_COLS) adjPairs.push([r, nr * REG_COLS + nc]);
    });
  }
  adjPairs.forEach(pair => {
    const [a, b] = pair;
    const A = nodes.filter(n => n.region === a);
    const B = nodes.filter(n => n.region === b);
    if (A.length === 0 || B.length === 0) return;
    const pairs = [];
    A.forEach(na => B.forEach(nb => pairs.push({ a: na.id, b: nb.id, d: diagonalDist(na.id, nb.id) })));
    pairs.sort((u, v) => u.d - v.d);
    const num = Math.random() < 0.5 ? 1 : (Math.random() < 0.5 ? 2 : 3);
    for (let i = 0; i < num && i < pairs.length; i++) addEdge(pairs[i].a, pairs[i].b, 'inter');
  });

  // Restituisci solo baseEdges (intra + inter) – backdoor gestiti separatamente
  const baseEdges = Object.keys(edgesMap).map(k => edgesMap[k]);

  // Debug % diagonali
  const diagCount = baseEdges.filter(e => {
    const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
    const dx = Math.abs(a.x - b.x) > 5, dy = Math.abs(a.y - b.y) > 5;
    return dx && dy;
  }).length;
  const pctDiag = (diagCount / baseEdges.length * 100).toFixed(0);
  console.log(`[BuildEdges] Base edges: ${baseEdges.length}, diagonali ~${pctDiag}% (bias: ${diagonalBiasPct}%)`);

  return baseEdges;
}