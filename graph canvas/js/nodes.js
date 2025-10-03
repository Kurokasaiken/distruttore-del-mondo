import { TOTAL_NODES } from './config.js';  // ← Fix: solo TOTAL_NODES usato qui; REG_ROWS/COLS non servono

export function distributeNodes(regions) {
  const base = Math.floor(TOTAL_NODES / regions.length);
  const counts = new Array(regions.length).fill(base);
  let rem = TOTAL_NODES - counts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (rem > 0) {
    counts[idx % regions.length]++;
    idx++;
    rem--;
  }

  const nodes = []; let id = 0;
  for (let rid = 0; rid < regions.length; rid++) {
    const cnt = counts[rid];
    const bb = regions[rid].bbox;
    const margin = 12;
    const innerW = bb.x1 - bb.x0 - 2 * margin;
    const innerH = bb.y1 - bb.y0 - 2 * margin;
    const cols = Math.max(1, Math.round(Math.sqrt(cnt * (innerW / innerH))));
    const rows = Math.max(1, Math.ceil(cnt / cols));
    const spacingX = innerW / cols;
    const spacingY = innerH / rows;
    let placed = 0;
    for (let r = 0; r < rows && placed < cnt; r++) {  // ← Loop righe (r = row)
      for (let c = 0; c < cols && placed < cnt; c++) {  // ← Loop colonne (c = column)
        const cx = bb.x0 + margin + (c + 0.5) * spacingX;  // ← Posizione centrale colonna c
        const cy = bb.y0 + margin + (r + 0.5) * spacingY;  // ← Posizione centrale riga r
        // ← Fix: jitter calcolato qui, per ogni nodo, con valore ridotto per più allineamenti
        const jitterX = (Math.random() - 0.5) * Math.min(spacingX * 0.05, 2);  // Max 2px, per più dx=0
        const jitterY = (Math.random() - 0.5) * Math.min(spacingY * 0.05, 2);  // Max 2px, per più dy=0
        const x = Math.round(cx + jitterX);
        const y = Math.round(cy + jitterY);
        nodes.push({ id: id, x, y, region: rid, type: 'normal' });
        id++;
        placed++;
      }
    }
    while (placed < cnt) {
      const x = Math.round(Math.random() * (bb.x1 - bb.x0 - 24) + bb.x0 + 12);
      const y = Math.round(Math.random() * (bb.y1 - bb.y0 - 24) + bb.y0 + 12);
      nodes.push({ id: id, x, y, region: rid, type: 'normal' });
      id++;
      placed++;
    }
  }
  while (nodes.length < TOTAL_NODES) {
    const r = Math.floor(Math.random() * regions.length);
    const bb = regions[r].bbox;
    nodes.push({
      id: nodes.length,
      x: Math.round(Math.random() * (bb.x1 - bb.x0 - 24) + bb.x0 + 12),
      y: Math.round(Math.random() * (bb.y1 - bb.y0 - 24) + bb.y0 + 12),
      region: r,
      type: 'normal'
    });
  }
  nodes.forEach((n, i) => n.id = i);
  return nodes;
}

export function nearestInRegion(nodes, regions, rid) {
  const list = nodes.filter(n => n.region === rid);
  let best = list[0], bd = 1e9;
  list.forEach(n => {
    const d = Math.hypot(n.x - regions[rid].seed[0], n.y - regions[rid].seed[1]);
    if (d < bd) { bd = d; best = n; }
  });
  return best;
}