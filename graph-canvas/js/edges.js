import { config } from './config.js';

export function buildEdges(nodes, regions, diagonalBiasPct = config.diagonalBiasPct) {
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

  const baseEdges = Object.keys(edgesMap).map(k => edgesMap[k]);

  // Debug % diagonali (usa type 'diagonal')
  const diagCount = baseEdges.filter(e => e.type === 'diagonal').length;
  const pctDiag = (diagCount / baseEdges.length * 100).toFixed(0);
  console.log(`[BuildEdges] Base edges: ${baseEdges.length}, diagonali ~${pctDiag}% (bias: ${diagonalBiasPct}%)`);

  return baseEdges;
}