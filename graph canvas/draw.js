import { el } from './utils.js';

export function drawGraph(graph, canvas = null, playerPos = null, playbackTrace = null, playbackIdx = 0) {
  if (!canvas) canvas = el('graphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!graph || !graph.nodes) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = '18px Inter';
    ctx.fillText('Premi "Genera & Valida" per creare una mappa valida', 24, 48);
    return;
  }
  
  // Calculate scale and offset
  const all = graph.regions.flatMap(r => [r.bbox.x0, r.bbox.x1, r.bbox.y0, r.bbox.y1]);
  const xs = graph.nodes.map(n => n.x).concat(all);
  const ys = graph.nodes.map(n => n.y).concat(all);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 40;
  
  const sx = (canvas.width - 2 * pad) / (maxX - minX);
  const sy = (canvas.height - 2 * pad) / (maxY - minY);
  const s = Math.min(sx, sy);
  
  const ox = pad - minX * s + (canvas.width - 2 * pad - (maxX - minX) * s) / 2;
  const oy = pad - minY * s + (canvas.height - 2 * pad - (maxY - minY) * s) / 2;
  
  // Background
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, 'rgba(3,7,16,0.9)');
  bg.addColorStop(1, 'rgba(6,11,20,0.65)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Regions
  const regionColors = [
    'rgba(14,165,233,0.12)', 'rgba(99,102,241,0.10)', 'rgba(96,165,250,0.10)',
    'rgba(34,197,94,0.08)', 'rgba(236,72,153,0.08)', 'rgba(250,204,21,0.06)',
    'rgba(79,70,229,0.06)', 'rgba(20,184,166,0.06)', 'rgba(96,165,250,0.06)'
  ];
  
  graph.regions.forEach((r, idx) => {
    const bb = r.bbox;
    const x = bb.x0 * s + ox, y = bb.y0 * s + oy;
    const w = (bb.x1 - bb.x0) * s, h = (bb.y1 - bb.y0) * s;
    
    ctx.fillStyle = regionColors[idx % regionColors.length];
    ctx.fillRect(x, y, w, h);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  });
  
  // Edges
  graph.edges.forEach(e => {
    const a = graph.nodes.find(n => n.id === e.from);
    const b = graph.nodes.find(n => n.id === e.to);
    
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
  
  // Nodes
  graph.nodes.forEach(n => {
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
  
  // Draw current player if set and not in playback
  if (playerPos !== null && !playbackTrace) {
    const pn = graph.nodes.find(n => n.id === playerPos);
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
      ctx.fillText('P', px - 4, py + 4);
    }
  }
  
  // Playback overlay
  if (playbackTrace && playbackIdx > 0 && playbackIdx <= playbackTrace.length) {
    const state = playbackTrace[Math.min(playbackIdx - 1, playbackTrace.length - 1)];
    
    // Build adjacency for patrol vision cones
    const adj = {};
    graph.nodes.forEach(n => adj[n.id] = new Set());
    graph.edges.forEach(e => {
      adj[e.from].add(e.to);
      adj[e.to].add(e.from);
    });
    
    const coneDepth = graph.params.CONE_DEPTH || 2;
    const coneAngle = graph.params.CONE_ANGLE || 80;
    const coords = {};
    graph.nodes.forEach(n => coords[n.id] = { x: n.x, y: n.y });
    
    // Draw patrols
    state.patrols.forEach((p, pi) => {
      const pos = p.pos;
      const prev = p.prev !== undefined ? p.prev : null;
      const center = graph.nodes.find(n => n.id === pos);
      const cx = center.x * s + ox, cy = center.y * s + oy;
      
      // Calculate direction vector
      let dirVec = { x: 0, y: -1 };
      if (prev !== null) {
        const pn = graph.nodes.find(n => n.id === prev);
        dirVec.x = center.x - pn.x;
        dirVec.y = center.y - pn.y;
        const m = Math.hypot(dirVec.x, dirVec.y) || 1;
        dirVec.x /= m;
        dirVec.y /= m;
      } else {
        const neigh = Array.from(adj[pos]);
        if (neigh.length > 0) {
          const nn = graph.nodes.find(n => n.id === neigh[0]);
          dirVec.x = nn.x - center.x;
          dirVec.y = nn.y - center.y;
          const m = Math.hypot(dirVec.x, dirVec.y) || 1;
          dirVec.x /= m;
          dirVec.y /= m;
        }
      }
      
      // Calculate vision cone
      const visited = new Set([pos]);
      const q = [{ id: pos, depth: 0 }];
      const coneNodes = [];
      
      while (q.length) {
        const it = q.shift();
        const node = graph.nodes.find(n => n.id === it.id);
        const vec = { x: node.x - center.x, y: node.y - center.y };
        const mag = Math.hypot(vec.x, vec.y) || 1;
        const dot = (vec.x * dirVec.x + vec.y * dirVec.y) / mag;
        const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        
        if (ang <= coneAngle / 2) coneNodes.push(node.id);
        
        if (it.depth < coneDepth) {
          for (const nb of Array.from(adj[it.id]))
            if (!visited.has(nb)) {
              visited.add(nb);
              q.push({ id: nb, depth: it.depth + 1 });
            }
        }
      }
      
      // Draw cone nodes
      ctx.fillStyle = 'rgba(239,68,68,0.12)';
      coneNodes.forEach(nid => {
        const n = graph.nodes.find(x => x.id === nid);
        ctx.beginPath();
        ctx.arc(n.x * s + ox, n.y * s + oy, 12, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw patrol
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,68,68,0.95)';
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = '10px monospace';
      ctx.fillText(String(pi + 1), cx - 4, cy + 4);
    });
    
    // Draw player (gold) in playback
    const pnode = graph.nodes.find(n => n.id === state.player);
    const px = pnode.x * s + ox, py = pnode.y * s + oy;
    
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
    ctx.fillText('P', px - 4, py + 5);
    
    // Draw alert status
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(12, 12, 120, 28);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.fillText('Alert: ' + state.alert, 18, 32);
  }
}
