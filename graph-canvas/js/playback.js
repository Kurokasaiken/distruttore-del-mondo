import { config } from './config.js';
import { drawGraph } from './draw.js';  // Import per drawGraph

let playbackIdx = 0;

export function playTrace(playbackTrace, canvas, ctx, currentGraph, currentPlayerPos, callback, playbackTimer) {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackIdx = 0;
  console.log('Step-by-step playback started: trace length', playbackTrace.length, 'sub-steps');
  if (!playbackTrace || !Array.isArray(playbackTrace) || playbackTrace.length === 0) {
    console.error('Invalid trace:', playbackTrace);
    return null;
  }
  if (!ctx || !canvas) {
    console.error('Invalid canvas/ctx:', canvas, ctx);  // Debug
    return null;
  }
  const timer = setInterval(() => {
    if (playbackIdx >= playbackTrace.length) {
      clearInterval(timer);
      console.log('Playback ended');
      playbackIdx = 0;
      if (callback) callback(playbackIdx);
      return;
    }

    const state = playbackTrace[playbackIdx];
    console.log('Step:', playbackIdx, state.phase, 'Player:', state.player, 'Alert:', state.alert, 'God:', state.god, 'Patrols:', state.patrolsCount);

    // Highlight per phase
    let controlledNodes = null, intentNodes = null;
    if (state.phase === 'patrol_intent' || state.phase === 'patrol_next_intent') {
      intentNodes = new Set(state.patrols.map(p => p.intent).filter(id => id !== null));
    } else if (state.phase === 'alert_trigger' && state.alertChanged) {
      controlledNodes = new Map([[state.player, 1]]);  // Rosso
    } else if (state.phase === 'player_move') {
      controlledNodes = new Map([[state.player, 1]]);  // Verde
    }

    // Draw (con ctx/canvas passati)
    drawGraph(canvas, ctx, currentGraph, state.player, playbackTrace, playbackIdx + 1, controlledNodes, intentNodes);
    playbackIdx++;
    if (callback) callback(playbackIdx);
  }, config.PLAYBACK_DELAY);
  return timer;
}