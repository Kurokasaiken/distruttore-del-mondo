// main.js - inizializzazione e preview
import { drawGraph } from './draw.js';
import { makeGraph } from './graph.js';
import { checkBackdoorValidity } from './backdoor.js';

let currentGraph = null; // global current graph    


window.addEventListener('load', ()=>{
  try{
    // preview graph (non necessariamente valido secondo tutti i checks)
    const preview = makeGraph({backdoorPct:8, minLen:3, maxLen:6, CONE_DEPTH:2, CONE_ANGLE:80});
    currentGraph = preview;
    drawGraph(currentGraph);
    document.getElementById('report').textContent = 'Preview grafico generato (puoi poi Genera & Valida per trovare uno valido secondo vincoli).';
    log('Anteprima generata.');
  }catch(e){
    console.error(e); log('Errore init: '+e.message);
  }

  // resize canvas to fit
  const canvas = document.getElementById('graphCanvas');
  function resize(){ canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; drawGraph(currentGraph); }
  window.addEventListener('resize', resize);
  setTimeout(resize,50);
});
