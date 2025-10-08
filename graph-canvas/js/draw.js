import { config } from './config.js';
import {
  drawBackground,
  drawRegions,
  drawEdges,
  drawNodes,
  drawPlayer,
  drawNoGraph
} from './draw-core.js';
import {
  drawStaticPatrols,
  drawPlaybackPatrols
} from './draw-patrol.js';

export function drawGraph(canvas, ctx, currentGraph, currentPlayerPos, playbackTrace, playbackIdx, controlledNodes = null, intentNodes = null) {
  console.log('Draw called with:', { hasGraph: !!currentGraph, nodes: currentGraph?.nodes?.length, edges: currentGraph?.edges?.length, controlled: controlledNodes ? controlledNodes.size : 0, intent: intentNodes ? intentNodes.size : 0 });
  
  if (!currentGraph) {
    drawNoGraph(ctx, canvas);
    console.log('Draw: no graph, show text');
    return;
  }

  const g = currentGraph;
  console.log('Draw: graph OK, nodes=', g.nodes.length, 'edges=', g.edges.length, 'regions=', g.regions.length);

  // Calcola bounds e transform
  const all = g.regions.flatMap(r => [r.bbox.x0, r.bbox.x1, r.bbox.y0, r.bbox.y1]);
  const xs = g.nodes.map(n => n.x).concat(all);
  const ys = g.nodes.map(n => n.y).concat(all);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  console.log('Bounds:', { minX, maxX, minY, maxY, diffX: maxX - minX, diffY: maxY - minY });
  if (maxX === minX || maxY === minY) {
    console.error('Draw: invalid bounds (diff=0)');
    return;
  }
  const pad = 40;
  const sx = (canvas.width - 2 * pad) / (maxX - minX);
  const sy = (canvas.height - 2 * pad) / (maxY - minY);
  console.log('Scale:', { sx, sy });
  const s = Math.min(sx, sy);
  if (isNaN(s)) {
    console.error('Draw: NaN scale');
    return;
  }
  const ox = pad - minX * s + (canvas.width - 2 * pad - (maxX - minX) * s) / 2;
  const oy = pad - minY * s + (canvas.height - 2 * pad - (maxY - minY) * s) / 2;
  console.log('Transform:', { s, ox, oy });

  // Rendering core
  drawBackground(ctx, canvas);
  drawRegions(ctx, g, s, ox, oy);
  drawEdges(ctx, g, s, ox, oy);
  drawNodes(ctx, g, s, ox, oy, controlledNodes, intentNodes);

  // Player (solo se non playback)
  if (!playbackTrace || playbackIdx === 0) {
    drawPlayer(ctx, g, currentPlayerPos, s, ox, oy);
  }

  // Pattuglie statiche (no playback)
  if (!playbackTrace && currentGraph.patrols && currentGraph.patrols.length > 0) {
    drawStaticPatrols(ctx, g, s, ox, oy, currentGraph.patrols);
  }

  // Playback
  if (playbackTrace && playbackIdx > 0 && playbackIdx <= playbackTrace.length) {
    const state = playbackTrace[Math.min(playbackIdx - 1, playbackTrace.length - 1)];
    drawPlaybackPatrols(ctx, g, s, ox, oy, playbackTrace, playbackIdx, state);
  }

  // Reset text align
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}