import { CONE_DEPTH, CONE_ANGLE } from './config.js';

export function draw(canvas, ctx, currentGraph, currentPlayerPos, playbackTrace, playbackIdx) {
  console.log('Draw called with:', { hasGraph: !!currentGraph, nodes: currentGraph?.nodes?.length, edges: currentGraph?.edges?.length });  // ← AGGIUNGI
  if (!currentGraph) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = '18px Inter';
    ctx.fillText('Premi "Genera & Valida" per creare una mappa valida', 24, 48);
    return;
  }

  const g = currentGraph;
  // Calcola bounds per scaling
  const all = g.regions.flatMap(r => [r.bbox.x0, r.bbox.x1, r.bbox.y0, r.bbox.y1]);
  const xs = g.nodes.map(n => n.x).concat(all);
  const ys = g.nodes.map(n => n.y).concat(all);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
console.log('Bounds:', { minX, maxX, minY, maxY });  // Debug graph boundaries
  const pad = 40;
  const sx = (canvas.width - 2 * pad) / (maxX - minX);
  const sy = (canvas.height - 2 * pad) / (maxY - minY);
  console.log('Scale:', { sx, sy });  // ← AGGIUNGI: scale infinito o zero?
  const s = Math.min(sx, sy);
  const ox = pad - minX * s + (canvas.width - 2 * pad - (maxX - minX) * s) / 2;
  const oy = pad - minY * s + (canvas.height - 2 * pad - (maxY - minY) * s) / 2;

  // Background gradient
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, 'rgba(3,7,16,0.9)');
  bg.addColorStop(1, 'rgba(6,11,20,0.65)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Disegna regioni
  const regionColors = [
    'rgba(14,165,233,0.12)', 'rgba(99,102,241,0.10)', 'rgba(96,165,250,0.10)',
    'rgba(34,197,94,0.08)', 'rgba(236,72,153,0.08)', 'rgba(250,204,21,0.06)',
    'rgba(79,70,229,0.06)', 'rgba(20,184,166,0.06)', 'rgba(96,165,250,0.06)'
  ];
  g.regions.forEach((r, idx) => {
    const bb = r.bbox;
    const x = bb.x0 * s + ox, y = bb.y0 * s + oy;
    const w = (bb.x1 - bb.x0) * s, h = (bb.y1 - bb.y0) * s;
    ctx.fillStyle = regionColors[idx % regionColors.length];
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  });

  // Disegna archi
  g.edges.forEach(e => {
    const a = g.nodes.find(n => n.id === e.from);
    const b = g.nodes.find(n => n.id === e.to);
    const x1 = a.x * s + ox, y1 = a.y * s + oy;
    const x2 = b.x * s + ox, y2 = b.y * s + oy;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (e.type === 'backdoor') {
      ctx.strokeStyle = 'rgba(251,146,60,0.95)';
      ctx.setLineDash([10, 6]);
      ctx.lineWidth = 2.6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(251,146,60,0.12)';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });

  // Disegna nodi
  g.nodes.forEach(n => {
    const x = n.x * s + ox, y = n.y * s + oy;
    if (n.type === 'start') {
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(96,165,250,0.06)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (n.type === 'goal') {
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52,211,153,0.06)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,14,18,0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  // Disegna player corrente (se non in playback)
  if (currentPlayerPos !== null && (!playbackTrace || playbackIdx === 0)) {
    const pn = g.nodes.find(n => n.id === currentPlayerPos);
    if (pn) {
      const px = pn.x * s + ox, py = pn.y * s + oy;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', px, py + 4);
    }
  }

  // Overlay playback (se attivo)
if (playbackTrace && playbackIdx > 0 && playbackIdx <= playbackTrace.length) {
  const state = playbackTrace[Math.min(playbackIdx - 1, playbackTrace.length - 1)];
  console.log('Rendering playback state:', { player: state.player, patrols: state.patrols.length, alert: state.alert });  // ← AGGIUNGI: conferma frame con player pos e pattuglie
    // Costruisci adj per il graph
    const adj = {};
    g.nodes.forEach(n => adj[n.id] = new Set());
    g.edges.forEach(e => {
      adj[e.from].add(e.to);
      adj[e.to].add(e.from);
    });
    // Cache coords
    const coords = {};
    g.nodes.forEach(n => coords[n.id] = { x: n.x * s + ox, y: n.y * s + oy });

    // Disegna coni per pattuglie
    state.patrols.forEach((p, pi) => {
      const pos = p.pos;
      const prev = p.prev !== undefined ? p.prev : null;
      const center = g.nodes.find(n => n.id === pos);
      if (!center) return;
      const cx = coords[pos].x, cy = coords[pos].y;
      let dirVec = { x: 0, y: -1 };  // Default up
      if (prev !== null) {
        const prevNode = g.nodes.find(n => n.id === prev);
        if (prevNode) {
          dirVec.x = center.x - prevNode.x;
          dirVec.y = center.y - prevNode.y;
          const m = Math.hypot(dirVec.x, dirVec.y) || 1;
          dirVec.x /= m;
          dirVec.y /= m;
        }
      } else {
        // Usa primo vicino per direzione
        const neigh = Array.from(adj[pos]);
        if (neigh.length > 0) {
          const nn = g.nodes.find(n => n.id === neigh[0]);
          if (nn) {
            dirVec.x = nn.x - center.x;
            dirVec.y = nn.y - center.y;
            const m = Math.hypot(dirVec.x, dirVec.y) || 1;
            dirVec.x /= m;
            dirVec.y /= m;
          }
        }
      }

      // BFS per cono
      const visited = new Set([pos]);
      const q = [{ id: pos, depth: 0 }];
      const coneNodes = [];
      while (q.length > 0) {
        const it = q.shift();
        const node = g.nodes.find(n => n.id === it.id);
        if (!node) continue;
        const vec = { x: node.x - center.x, y: node.y - center.y };
        const mag = Math.hypot(vec.x, vec.y) || 1;
        const dot = (vec.x * dirVec.x + vec.y * dirVec.y) / mag;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        if (ang <= CONE_ANGLE / 2) coneNodes.push(node.id);
        if (it.depth < CONE_DEPTH) {
          for (const nb of Array.from(adj[it.id])) {
            if (!visited.has(nb)) {
              visited.add(nb);
              q.push({ id: nb, depth: it.depth + 1 });
            }
          }
        }
      }

      // Disegna nodi del cono (rosso trasparente)
      ctx.fillStyle = 'rgba(239,68,68,0.12)';
      coneNodes.forEach(nid => {
        if (coords[nid]) {
          ctx.beginPath();
          ctx.arc(coords[nid].x, coords[nid].y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Disegna pattuglia
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,68,68,0.95)';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pi + 1), cx, cy + 4);
    });

    // Disegna player in playback (oro)
    const pnode = g.nodes.find(n => n.id === state.player);
    if (pnode && coords[state.player]) {
      const px = coords[state.player].x, py = coords[state.player].y;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText('P', px, py + 5);
    }

    // Overlay alert
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(12, 12, 120, 28);
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Alert: ' + state.alert, 18, 28);
  }

  // Reset text align per future chiamate
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}