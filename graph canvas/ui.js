// ui.js
function el(id){ return document.getElementById(id); }
function log(msg){ el('log').textContent = new Date().toISOString().slice(11,19) + ' — ' + msg + '\n' + el('log').textContent; }

document.addEventListener('DOMContentLoaded', ()=>{
  el('genBtn').addEventListener('click', ()=> runGeneration());
  el('simBtn').addEventListener('click', ()=> runSimulation());
  el('batchBtn').addEventListener('click', ()=> runBatchSim());
  el('downloadBtn').addEventListener('click', ()=> downloadJSON());
  el('copyBtn').addEventListener('click', ()=> copyJSON());
});

function runGeneration(){
  const backdoorPct = parseFloat(el('backdoorPct').value)||8;
  const minLen = parseInt(el('backdoorMin').value,10)||3;
  const maxLen = parseInt(el('backdoorMax').value,10)||6;
  const attemptsMax = parseInt(el('attemptsMax').value,10)||30;
  log('Generazione: backdoorPct='+backdoorPct+', min='+minLen+', max='+maxLen);
  let success=false; let last=null;
  for(let i=1;i<=attemptsMax;i++){
    const g = makeGraph({backdoorPct, minLen, maxLen, CONE_DEPTH:2, CONE_ANGLE:80});
    const check = checkBackdoorValidity(g, minLen, maxLen);
    // check shortest path length (min nodes to win)
    const adj = buildAdj(g.edges, g.nodes);
    const d = bfsHop(adj, g.nodes.find(n=>n.type==='start').id);
    const sp = d[g.nodes.find(n=>n.type==='goal').id] || Infinity;
    if(sp < 50){ log('Tentativo '+i+' scartato: shortestPath troppo corto ('+sp+')'); last = Object.assign({}, check, {shortest:sp}); continue; }
    if(check.failures.length===0){ currentGraph = g; success=true; last = check; break; }
    else { last = check; log('Tentativo '+i+' fallito ('+check.failures.length+' issues)'); }
  }
  if(!success){ el('report').textContent = 'Nessun grafo valido entro '+attemptsMax+' tentativi\\n'+JSON.stringify(last,null,2); drawGraph(currentGraph); return; }
  el('report').textContent = JSON.stringify(last,null,2);
  drawGraph(currentGraph);
  log('Grafo valido generato.');
}

function runSimulation(){
  if(!currentGraph){ alert('Genera prima un grafo valido'); return; }
  const res = simulateTrace(currentGraph);
  log('Run outcome: '+res.outcome+' turns:'+res.turns);
  playTrace(res, 'graphCanvas', parseInt(el('playSpeed').value,10)||600);
}

function runBatchSim(){
  if(!currentGraph){ alert('Genera prima un grafo valido'); return; }
  log('Inizio batch 100 simulazioni...');
  setTimeout(()=>{
    const out = evaluateGraph(currentGraph, 100);
    el('stats').textContent = JSON.stringify(out.stats, null, 2);
    log('Batch completato.');
  }, 50);
}

function downloadJSON(){
  if(!currentGraph){ alert('Genera prima un grafo valido'); return; }
  const blob = new Blob([exportGraphJSON()],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='graph_valid.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function copyJSON(){
  if(!currentGraph){ alert('Genera prima un grafo valido'); return; }
  navigator.clipboard.writeText(exportGraphJSON()).then(()=>{ alert('JSON copiato negli appunti'); }).catch(()=>{ alert('Copia fallita'); });
}
