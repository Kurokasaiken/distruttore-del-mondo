import { config } from './config.js';  // Fix: Importa oggetto config

let playbackIdx = 0;

export function playTrace(playbackTrace, canvas, ctx, currentGraph, currentPlayerPos, playbackTimer) {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackIdx = 0;
  console.log('Playback started: trace length', playbackTrace.length, 'frames');
  const timer = setInterval(() => {
    playbackIdx++;
    console.log('Playback frame:', playbackIdx);
    if (playbackIdx > playbackTrace.length) {
      clearInterval(timer);
      console.log('Playback ended');
      playbackIdx = 0;
      return;
    }
    drawGraph(canvas, ctx, currentGraph, null, playbackTrace, playbackIdx);  // Assumi drawGraph importato se serve
  }, config.PLAYBACK_DELAY);  // Fix: Usa config.PLAYBACK_DELAY
  return timer;
}