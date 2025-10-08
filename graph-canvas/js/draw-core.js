import { config } from './config.js';

// Funzione per lo sfondo
export function drawBackground(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, 'rgba(3,7,16,0.9)');
  bg.addColorStop(1, 'rgba(6,11,20,0.65)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Funzione per le regioni
export function drawRegions(ctx, g, s, ox, oy) {
  console.log('Drawing regions:', g.regions.length);
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
}

// Funzione per gli edges
export function drawEdges(ctx, g, s, ox, oy) {
  console.log('Drawing edges:', g.edges.length);
  g.edges.forEach(e => {
    const a = g.nodes.find(n => n.id === e.from);
    const b = g.nodes.find(n => n.id === e.to);
    if (!a || !b) {
      console.warn('Edge missing nodes:', e);
      return;
    }
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
}

// Funzione per i nodes
export function drawNodes(ctx, g, s, ox, oy, controlledNodes = null, intentNodes = null) {
  console.log('Drawing nodes:', g.nodes.length);
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

    if (controlledNodes && controlledNodes.has(n.id)) {
      const count = controlledNodes.get(n.id);
      const alpha = 0.12 + (count - 1) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(239,68,68,${alpha})`;
      ctx.fill();
    }

    if (intentNodes && intentNodes.has(n.id)) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,146,60,0.15)';
      ctx.fill();
    }
  });
}

// Funzione per il player
export function drawPlayer(ctx, g, currentPlayerPos, s, ox, oy) {
  if (currentPlayerPos !== null) {
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
}

// Funzione per no-graph
export function drawNoGraph(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.font = '18px Inter';
  ctx.fillText('Premi "Genera & Valida" per creare una mappa valida', 24, 48);
}