export function generateBackdoors(nodes, regions, baseEdges, backdoorPct, minLen, maxLen, opts = {}) {
  const {
    startRegion = 3, goalRegion = 5, regRows = 3, regCols = 3, forwardWeight = 0.5
  } = opts;
  console.log(`[Backdoors] Start: num_target=${Math.max(1, Math.round((backdoorPct / 100) * nodes.length))}, minHops=${minLen}, maxHops=${maxLen}, forwardTarget=${forwardWeight*100}%`);

  // Step 1: Candidati bordi (pad aumentato a 0.2 per meno in A)
  const mapBBox = {
    x0: Math.min(...regions.map(r => r.bbox.x0)),
    y0: Math.min(...regions.map(r => r.bbox.y0)),
    x1: Math.max(...regions.map(r => r.bbox.x1)),
    y1: Math.max(...regions.map(r => r.bbox.y1))
  };
  const borderCandidates = nodes.filter(n => {
    if (n.region === startRegion) return false;
    const rbb = regions[n.region].bbox;
    const padX = (rbb.x1 - rbb.x0) * 0.2, padY = (rbb.y1 - rbb.y0) * 0.2;  // ← Fix: 0.2 per bordi stretti
    const regDist = Math.min(
      Math.abs(n.x - rbb.x0), Math.abs(n.x - rbb.x1),
      Math.abs(n.y - rbb.y0), Math.abs(n.y - rbb.y1)
    );
    const mapEdgeDist = Math.min(
      Math.abs(n.x - mapBBox.x0), Math.abs(n.x - mapBBox.x1),
      Math.abs(n.y - mapBBox.y0), Math.abs(n.y - mapBBox.y1)
    );
    return regDist <= Math.max(padX, padY) || mapEdgeDist <= Math.max(padX, padY);
  });
  console.log(`[Backdoors] Candidati bordi: ${borderCandidates.length} nodi`);

  // Step 2: Coppie (sort ascending d per low hops/distribuzione)
  const candPairs = [];
  for (let i = 0; i < borderCandidates.length; i++) {
    for (let j = i + 1; j < borderCandidates.length; j++) {
      const A = borderCandidates[i], B = borderCandidates[j];
      if (A.region === B.region) continue;
      candPairs.push({ a: A, b: B, d: Math.hypot(A.x - B.x, A.y - B.y) });
    }
  }
  candPairs.sort((u, v) => u.d - v.d);  // ← Fix: ascending d (low hops first, più B/C)
  console.log(`[Backdoors] Coppie generate: ${candPairs.length}, top d=${candPairs[0]?.d?.toFixed(0)}`);

  // Step 3: BFS per hops
  const adjNoBack = {}; nodes.forEach(n => adjNoBack[n.id] = new Set());
  baseEdges.forEach(e => {
    adjNoBack[e.from].add(e.to);
    adjNoBack[e.to].add(e.from);
  });

  function bfsNoBack(a, b) {
    const q = [a]; const dist = { [a]: 0 };
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

  function regionRow(region) { return Math.floor(region / regCols); }
  function regionDistToGoal(region) {
    const rr = Math.floor(region / regCols), rc = region % regCols;
    const gr = Math.floor(goalRegion / regCols), gc = goalRegion % regCols;
    return Math.abs(rr - gr) + Math.abs(rc - gc);
  }

  const num_backdoors = Math.max(1, Math.round((backdoorPct / 100) * nodes.length));
  const forwardTarget = Math.round(num_backdoors * forwardWeight);
  const lateralTarget = num_backdoors - forwardTarget;
  let f = 0, l = 0, added = [];
  const used = new Set();

  // Pass 1: Restrittivo (hops esatti + split, con forward da B a C)
  console.log(`[Backdoors] Pass 1: Restrittivo (target f=${forwardTarget}, l=${lateralTarget})`);
  for (const p of candPairs) {
    if (f >= forwardTarget && l >= lateralTarget) break;
    const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
    if (used.has(key)) continue;
    const hops = bfsNoBack(p.a.id, p.b.id);
    if (hops === Infinity || hops < minLen || hops > maxLen) continue;
    const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
    const isForward = Math.min(da, db) < Math.max(da, db);
    const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
    const forwardAllowed = isForward && (rowA !== 1 || rowB !== 1) && (rowA === 2 || rowB === 2 || (rowA === 1 && rowB === 2));  // ← Fix: allow B to C forward
    if (forwardAllowed && f < forwardTarget) {
      added.push({ from: p.a.id, to: p.b.id, type: 'backdoor' });
      used.add(key);
      f++;
      console.log(`[Backdoors] Added forward: ${p.a.id}-${p.b.id} (${regions[p.a.region].name}-${regions[p.b.region].name}), hops=${hops}, d=${p.d.toFixed(0)}`);
    } else if (!isForward && l < lateralTarget) {
      added.push({ from: p.a.id, to: p.b.id, type: 'backdoor' });
      used.add(key);
      l++;
      console.log(`[Backdoors] Added lateral: ${p.a.id}-${p.b.id} (${regions[p.a.region].name}-${regions[p.b.region].name}), hops=${hops}, d=${p.d.toFixed(0)}`);
    }
  }
  console.log(`[Backdoors] Pass 1: Added ${added.length} (f=${f}, l=${l})`);

  // Pass 2 e 3 invariati (ponderato + fill, con log regioni per debug)
  if (f + l < num_backdoors) {
    console.log(`[Backdoors] Pass 2: Ponderato (remaining ${num_backdoors - (f + l)})`);
    const remaining = candPairs.filter(p => {
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      return !used.has(key);
    }).map(p => {
      const hops = bfsNoBack(p.a.id, p.b.id);
      const diff = (hops === Infinity) ? Infinity : Math.abs(hops - (minLen + maxLen) / 2);
      return { ...p, hops, diff };
    }).filter(p => p.hops !== Infinity && p.hops >= minLen && p.hops <= maxLen);
    remaining.sort((A, B) => A.diff - B.diff || B.d - A.d);
    for (const p of remaining) {
      if (f + l >= num_backdoors) break;
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      if (used.has(key)) continue;
      const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
      const isForward = Math.min(da, db) < Math.max(da, db);
      const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
      const forwardAllowed = isForward && (rowA !== 1 || rowB !== 1) && (rowA === 2 || rowB === 2 || (rowA === 1 && rowB === 2));
      added.push({ from: p.a.id, to: p.b.id, type: 'backdoor' });
      used.add(key);
      if (forwardAllowed) f++;
      else l++;
      console.log(`[Backdoors] Added ponderato: ${p.a.id}-${p.b.id} (${regions[p.a.region].name}-${regions[p.b.region].name}), hops=${p.hops}, diff=${p.diff.toFixed(1)}`);
    }
  }

  if (f + l < num_backdoors) {
    console.log(`[Backdoors] Pass 3: Fill (remaining ${num_backdoors - (f + l)})`);
    const freeCandidates = candPairs.filter(p => {
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      return !used.has(key);
    }).filter(p => {
      const hops = bfsNoBack(p.a.id, p.b.id);
      return hops !== Infinity && hops >= minLen && hops <= maxLen;
    });
    freeCandidates.sort((A, B) => B.d - A.d);
    for (const p of freeCandidates) {
      if (f + l >= num_backdoors) break;
      const key = p.a.id < p.b.id ? p.a.id + ',' + p.b.id : p.b.id + ',' + p.a.id;
      added.push({ from: p.a.id, to: p.b.id, type: 'backdoor' });
      used.add(key);
      const da = regionDistToGoal(p.a.region), db = regionDistToGoal(p.b.region);
      const isForward = Math.min(da, db) < Math.max(da, db);
      const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
      if (isForward && (rowA !== 1 || rowB !== 1) && (rowA === 2 || rowB === 2 || (rowA === 1 && rowB === 2))) f++;
      else l++;
      console.log(`[Backdoors] Added fill: ${p.a.id}-${p.b.id} (${regions[p.a.region].name}-${regions[p.b.region].name}), hops=${bfsNoBack(p.a.id, p.b.id)}`);
    }
  }

  // Meta per test/debug
  const finalPct = added.length ? Math.round((f / added.length) * 100) : 0;
  const failures = added.length < num_backdoors ? [`Only ${added.length}/${num_backdoors} backdoors added`] : [];
  const avgHops = added.reduce((sum, e) => sum + bfsNoBack(e.from, e.to), 0) / added.length || 0;
  console.log(`[Backdoors] Final: ${added.length} added (f=${finalPct}%, l=${100-finalPct}%, avgHops=${avgHops.toFixed(1)}), failures=${failures.length}`);

  return {
    edges: added,
    meta: { numAdded: added.length, forwardPct: finalPct, lateralPct: 100 - finalPct, avgHops: avgHops.toFixed(1), failures }
  };
}