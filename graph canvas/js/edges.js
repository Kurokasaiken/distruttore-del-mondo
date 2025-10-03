import { REG_COLS, START_REGION, GOAL_REGION, NUM_REGIONS, REG_ROWS } from './config.js';  // ← Fix: assicurati NUM_REGIONS e REG_ROWS inclusi

export function buildEdges(nodes, regions, backdoorPct, minLen, maxLen, diagonalBiasPct = 70) {
  minLen = (typeof minLen === 'number') ? minLen : 3;
  maxLen = (typeof maxLen === 'number') ? maxLen : 6;
  const coord = {}; nodes.forEach(n => coord[n.id] = n);
  const edgesMap = {};

  function addEdge(a, b, type) {
    if (a === b) return;
    const key = a < b ? a + ',' + b : b + ',' + a;
    if (!edgesMap[key]) edgesMap[key] = { from: Math.min(a, b), to: Math.max(a, b), type: type || 'intra' };
  }

  function regionRow(region) { return Math.floor(region / REG_COLS); }

  // Helper: Calcola distanza con penalità per non-diagonali
function diagonalDist(u, v, biasPct = diagonalBiasPct) {
  try {
    const dx = Math.abs(coord[u].x - coord[v].x);
    const dy = Math.abs(coord[u].y - coord[v].y);
    const dist = Math.hypot(dx, dy);
    const isDiagonal = dx > 0 && dy > 0;
    const penalty = 1 + (biasPct / 100) * 0.5;
    return isDiagonal ? dist : dist * penalty;
  } catch (e) {
    console.warn('Diagonal dist error:', e, u, v);  // Debug
    return Math.hypot(coord[u].x - coord[v].x, coord[u].y - coord[v].y);  // Fallback
  }
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
          const d = diagonalDist(u, v);  // ← Modifica: usa dist penalizzata
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
    same.sort((a, b) => diagonalDist(n.id, a.id) - diagonalDist(n.id, b.id));  // ← Modifica: sort penalizzato
    for (let i = 0; i < Math.min(k_extra, same.length); i++) addEdge(n.id, same[i].id, 'intra');
  });

  // Inter-region adjacencies (favorisce diagonali tra regioni adiacenti)
  const adjPairs = [];
  for (let r = 0; r < NUM_REGIONS; r++) {
    const rr = Math.floor(r / REG_COLS), rc = r % REG_COLS;
    [[0, 1], [1, 0]].forEach(d => {  // Solo adiacenti, ma penalizza per diagonali
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
    A.forEach(na => B.forEach(nb => pairs.push({ a: na.id, b: nb.id, d: diagonalDist(na.id, nb.id) })));  // ← Modifica: dist penalizzata
    pairs.sort((u, v) => u.d - v.d);
    const num = Math.random() < 0.5 ? 1 : (Math.random() < 0.5 ? 2 : 3);
    for (let i = 0; i < num && i < pairs.length; i++) addEdge(pairs[i].a, pairs[i].b, 'inter');
  });

  // Prepare backdoor candidates (invariato, per non alterare metriche)
  const num_backdoors = Math.max(1, Math.round((backdoorPct / 100) * nodes.length));
  const mapBBox = {
    x0: Math.min(...regions.map(r => r.bbox.x0)),
    y0: Math.min(...regions.map(r => r.bbox.y0)),
    x1: Math.max(...regions.map(r => r.bbox.x1)),
    y1: Math.max(...regions.map(r => r.bbox.y1))
  };
  const borderCandidates = nodes.filter(n => {
    if (n.region === START_REGION) return false;
    const rbb = regions[n.region].bbox;
    const padX = (rbb.x1 - rbb.x0) * 0.16, padY = (rbb.y1 - rbb.y0) * 0.16;
    const regDist = Math.min(Math.abs(n.x - rbb.x0), Math.abs(n.x - rbb.x1), Math.abs(n.y - rbb.y0), Math.abs(n.y - rbb.y1));
    const mapEdgeDist = Math.min(Math.abs(n.x - mapBBox.x0), Math.abs(n.x - mapBBox.x1), Math.abs(n.y - mapBBox.y0), Math.abs(n.y - mapBBox.y1));
    return regDist <= Math.max(padX, padY) || mapEdgeDist <= Math.max(padX, padY);
  });
  const candPairs = [];
  for (let i = 0; i < borderCandidates.length; i++) {
    for (let j = i + 1; j < borderCandidates.length; j++) {
      const A = borderCandidates[i], B = borderCandidates[j];
      if (A.region === B.region) continue;
      candPairs.push({ a: A, b: B, d: Math.hypot(A.x - B.x, A.y - B.y) });
    }
  }
  candPairs.sort((u, v) => v.d - u.d);

  // Build adjacency without backdoors
  const adjNoBack = {}; nodes.forEach(n => adjNoBack[n.id] = new Set());
  for (const k in edgesMap) {
    const e = edgesMap[k];
    if (!e) continue;
    adjNoBack[e.from].add(e.to);
    adjNoBack[e.to].add(e.from);
  }

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

  function regionDistToGoal(region) {
    const rr = Math.floor(region / REG_COLS), rc = region % REG_COLS;
    const gr = Math.floor(GOAL_REGION / REG_COLS), gc = GOAL_REGION % REG_COLS;
    return Math.abs(rr - gr) + Math.abs(rc - gc);
  }

  const forwardTarget = Math.round(num_backdoors * 0.5);
  const lateralTarget = num_backdoors - forwardTarget;
  let f = 0, l = 0;
  const used = new Set();

  // First pass: add only backdoors that satisfy hop-length constraints and forward-only in rows A/C
  for (const p of candPairs) {
    if (f >= forwardTarget && l >= lateralTarget) break;
    const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
    if (used.has(key)) continue;
    const hops = bfsNoBack(p.a.id, p.b.id);
    if (hops === Infinity) continue;
    if (hops < minLen || hops > maxLen) continue;
    const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
    const isForward = Math.min(da, db) < Math.max(da, db);
    const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
    const forwardAllowed = isForward && rowA !== 1 && rowB !== 1;
    if (forwardAllowed && f < forwardTarget) {
      addEdge(p.a.id, p.b.id, 'backdoor');
      used.add(key);
      f++;
    } else if (!isForward && l < lateralTarget) {
      addEdge(p.a.id, p.b.id, 'backdoor');
      used.add(key);
      l++;
    }
  }

  // Ponderated second pass (prefer candidates close to hop range)
  if (f + l < num_backdoors) {
    const remaining = candPairs.filter(p => {
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      return !used.has(key);
    }).map(p => {
      const hops = bfsNoBack(p.a.id, p.b.id);
      const diff = (hops === Infinity) ? Infinity : (hops < minLen ? (minLen - hops) : (hops > maxLen ? hops - maxLen : 0));
      return Object.assign({}, p, { hops, diff });
    });
    remaining.sort((A, B) => {
      if (A.diff !== B.diff) return A.diff - B.diff;
      return B.d - A.d;
    });
    for (const p of remaining) {
      if (f + l >= num_backdoors) break;
      if (p.hops === Infinity) continue;
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      if (used.has(key)) continue;
      const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
      const isForward = Math.min(da, db) < Math.max(da, db);
      const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
      const forwardAllowed = isForward && rowA !== 1 && rowB !== 1;
      addEdge(p.a.id, p.b.id, 'backdoor');
      used.add(key);
      if (forwardAllowed) f++;
      else l++;
    }
  }

  // Final fill: allow any remaining candidates but classify forward only if rows A/C
  if (f + l < num_backdoors) {
    const freeCandidates = candPairs.filter(p => {
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      return !used.has(key);
    });
    for (const p of freeCandidates) {
      if (f + l >= num_backdoors) break;
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      addEdge(p.a.id, p.b.id, 'backdoor');
      used.add(key);
      const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
      const isForward = Math.min(da, db) < Math.max(da, db);
      const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
      if (isForward && rowA !== 1 && rowB !== 1) f++;
      else l++;
    }
  }

  const finalEdges = Object.keys(edgesMap).map(k => edgesMap[k]);

  // Calcola % diagonali e log in UI (se log funzione disponibile, altrimenti console)
  const diagCount = finalEdges.filter(e => {
    const a = nodes.find(n => n.id === e.from), b = nodes.find(n => n.id === e.to);
    const dx = Math.abs(a.x - b.x) > 0, dy = Math.abs(a.y - b.y) > 0;
    return dx && dy;
  }).length;
  const pctDiag = (diagCount / finalEdges.length * 100).toFixed(0);
  console.log(`Edges: ${finalEdges.length}, Diagonali: ${diagCount} (~${pctDiag}% con bias ${diagonalBiasPct}%)`);
  // Opzionale: se hai log da utils, log(`% Diagonali: ${pctDiag}%`);

  return finalEdges;
}