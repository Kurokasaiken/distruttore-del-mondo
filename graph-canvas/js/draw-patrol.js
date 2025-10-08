import { config } from './config.js';
import { computeDirVecAndCone } from './patrol-control.js';

// Helper per disegnare cono orientato
export function drawOrientedCone(ctx, cx, cy, dirVec) {
  const halfA = config.coneAngle / 2 * Math.PI / 180;
  const coneLength = 100;
  ctx.save();
  ctx.translate(cx, cy);
  const rot = Math.atan2(dirVec.y, dirVec.x);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(coneLength * Math.cos(-halfA), coneLength * Math.sin(-halfA));
  ctx.lineTo(coneLength * Math.cos(halfA), coneLength * Math.sin(halfA));
  ctx.closePath();
  ctx.fillStyle = 'rgba(251,146,60,0.08)';
  ctx.fill();
  ctx.restore();
}

export function drawStaticPatrols(ctx, g, s, ox, oy, patrols) {
  if (!patrols || patrols.length === 0) return;
  console.log('Drawing static patrols:', patrols.length);

  const adj = {};
  g.nodes.forEach(n => adj[n.id] = new Set());
  g.edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });
  const coords = {};
  g.nodes.forEach(n => coords[n.id] = { x: n.x * s + ox, y: n.y * s + oy });

  const patrolCounts = new Map();
  patrols.forEach(p => {
    patrolCounts.set(p.currentNode || p.pos, (patrolCounts.get(p.currentNode || p.pos) || 0) + 1);
  });

  patrols.forEach((p, pi) => {
    const { dirVec, coneNodes } = computeDirVecAndCone(g, p, adj);
    const pos = p.pos || p.currentNode;
    const nextIntent = p.intent || p.nextIntent || null;
    const cx = coords[pos]?.x || 0, cy = coords[pos]?.y || 0;

    // Highlight next move
    if (nextIntent) {
      const nextNode = g.nodes.find(n => n.id === nextIntent);
      if (nextNode) {
        const nx = nextNode.x * s + ox, ny = nextNode.y * s + oy;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = 'rgba(59,130,246,0.6)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Disegna cono
    drawOrientedCone(ctx, cx, cy, dirVec);

    // Disegna nodi cono
    ctx.fillStyle = 'rgba(220,38,38,0.18)';
    coneNodes.forEach(nid => {
      if (coords[nid]) {
        ctx.beginPath();
        ctx.arc(coords[nid].x, coords[nid].y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Marker pattuglia
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pi + 1), cx, cy + 4);

    // Conta sovrapposizioni
    const count = patrolCounts.get(pos);
    if (count > 1) {
      ctx.fillStyle = 'white';
      ctx.font = '8px monospace';
      ctx.fillText(String(count), cx, cy - 2);
    }
  });
}

export function drawPlaybackPatrols(ctx, g, s, ox, oy, playbackTrace, playbackIdx, state) {
  if (!playbackTrace || playbackIdx <= 0 || playbackIdx > playbackTrace.length || !state) return;
  console.log('Rendering playback state:', { player: state.player, patrols: state.patrols.length, alert: state.alert });

  const adj = {};
  g.nodes.forEach(n => adj[n.id] = new Set());
  g.edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });
  const coords = {};
  g.nodes.forEach(n => coords[n.id] = { x: n.x * s + ox, y: n.y * s + oy });

  const patrolCounts = new Map();
  state.patrols.forEach(p => {
    patrolCounts.set(p.pos, (patrolCounts.get(p.pos) || 0) + 1);
  });

  state.patrols.forEach((p, pi) => {
    const { dirVec, coneNodes } = computeDirVecAndCone(g, p, adj);
    const pos = p.pos;
    const cx = coords[pos]?.x || 0, cy = coords[pos]?.y || 0;

    // Highlight next move
    const nextIntent = p.intent || null;
    if (nextIntent) {
      const nextNode = g.nodes.find(n => n.id === nextIntent);
      if (nextNode) {
        const nx = nextNode.x * s + ox, ny = nextNode.y * s + oy;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = 'rgba(59,130,246,0.6)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Disegna cono
    drawOrientedCone(ctx, cx, cy, dirVec);

    // Disegna nodi cono
    ctx.fillStyle = 'rgba(220,38,38,0.18)';
    coneNodes.forEach(nid => {
      if (coords[nid]) {
        ctx.beginPath();
        ctx.arc(coords[nid].x, coords[nid].y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Marker pattuglia
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pi + 1), cx, cy + 4);

    // Conta sovrapposizioni
    const count = patrolCounts.get(pos);
    if (count > 1) {
      ctx.fillStyle = 'white';
      ctx.font = '8px monospace';
      ctx.fillText(String(count), cx, cy - 2);
    }
  });

  // Player in playback
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