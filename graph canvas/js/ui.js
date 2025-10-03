import { el, log } from './utils.js';
import { makeGraph, pruneBackdoorsByHop, checkBackdoorValidity } from './graph.js';
import { draw } from './draw.js';
import { simulateTrace, playTrace } from './simulate.js';
import { TOTAL_NODES, NUM_REGIONS, START_REGION, GOAL_REGION, REG_ROWS, REG_COLS } from './config.js';

let currentGraph = null;
let currentPlayerPos = null;
let playbackTrace = null;
let playbackTimer = null;
let canvas, ctx;

export async function loadPartials() {
  console.log('Loading partials...');  // Debug
  try {
    const response = await fetch('./partials/panel.html');
    if (!response.ok) throw new Error('Fetch failed');
    document.getElementById('panel').innerHTML = await response.text();
    console.log('Partials loaded via fetch.');  // Success
  } catch (error) {
    console.warn('Load partials failed:', error);  // Fallback
    // Fallback: incolla HTML diretto qui se fetch rompe (dal tuo originale, + input bias)
    document.getElementById('panel').innerHTML = `
      <div id="panel" class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><h3 style="margin:0">Graph Builder</h3><div class="small" id="info">150 nodi — 3×3 quartieri — Start B1 — Tower B3</div></div>
          <div class="small">Preview</div>
        </div>
        <hr />
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="small">Backdoor % <input id="backdoorPct" type="number" value="8" style="width:70px;margin-left:8px"></label>
          <label class="small">Min backdoor hops <input id="backdoorMinLen" type="number" value="3" style="width:70px;margin-left:8px"></label>
          <label class="small">Max backdoor hops <input id="backdoorMaxLen" type="number" value="6" style="width:70px;margin-left:8px"></label>
          <label class="small">Diagonal Bias % <input id="diagonalBiasPct" type="number" value="70" min="0" max="100" style="width:70px;margin-left:8px"></label>  <!-- ← Aggiunto input bias -->
          <div style="display:flex;gap:8px;margin-top:6px">
            <button id="runBtn" class="btn">Genera & Valida</button>
            <button id="simBtn" class="btn">Gioca Run</button>
          </div>
        </div>
        <div class="card" style="margin-top:12px">
          <div class="small">Log</div>
          <pre id="log" style="height:140px;overflow:auto;background:transparent;color:#9fd3df;padding:8px;border-radius:6px;">Pronto</pre>
          <div class="legend">
            <div class="item"><div class="swatch" style="background:rgba(14,165,233,0.22)"></div>Regioni</div>
            <div class="item"><div class="swatch" style="background:#0f1724;border:2px solid #e6eef8"></div>Nodi</div>
            <div class="item"><div class="swatch" style="background:var(--edge)"></div>Archi</div>
            <div class="item"><div class="swatch" style="background:var(--accent-c)"></div>Backdoor</div>
            <div class="item"><div class="swatch" style="background:#60a5fa"></div>Start</div>
            <div class="item"><div class="swatch" style="background:#34d399"></div>Tower</div>
            <div class="item"><div class="swatch" style="background:#ef4444"></div>Pattuglie</div>
            <div class="item"><div class="swatch" style="background:#FFD700"></div>Giocatore</div>
          </div>
        </div>
      </div>
    `;
    console.log('Fallback HTML loaded.');  // Fallback success
  }
}

export async function initUI() {
  console.log('initUI called');  // Debug
  canvas = el('graphCanvas');
  if (!canvas) { console.error('Canvas not found!'); return; }
  ctx = canvas.getContext('2d');
  const backdoorPctEl = el('backdoorPct');
  const minLenEl = el('backdoorMinLen');
  const maxLenEl = el('backdoorMaxLen');
  const diagonalBiasEl = el('diagonalBiasPct');  // ← Fix: qui, non nel click
  const runBtn = el('runBtn');
  const simBtn = el('simBtn');
  const infoEl = el('info');
  if (!runBtn || !simBtn || !infoEl || !diagonalBiasEl) { console.error('UI elements missing!'); return; }

  // Imposta info (dal tuo originale)
  infoEl.textContent = `${TOTAL_NODES} nodi — ${REG_ROWS}×${REG_COLS} quartieri — Start ${String.fromCharCode(65 + Math.floor(START_REGION / REG_COLS))}${START_REGION % REG_COLS + 1} — Tower ${String.fromCharCode(65 + Math.floor(GOAL_REGION / REG_COLS))}${GOAL_REGION % REG_COLS + 1}`;

  // Expose for console (dal tuo originale)
  window.__graph_tools = { makeGraph, pruneBackdoorsByHop, checkBackdoorValidity, simulateTrace };

  // Handler Genera & Valida (con debug dettagliato sui failures)
  runBtn.addEventListener('click', async () => { 
    try {  // ← Fix: cattura errori
      console.log('RunBtn clicked');
      const attemptsMax = 30; 
      const backdoorPct = parseFloat(backdoorPctEl.value)||8; 
      const minLen = parseInt(minLenEl.value,10)||3; 
      const maxLen = parseInt(maxLenEl.value,10)||6; 
      const diagonalBiasPct = parseFloat(diagonalBiasEl.value)||70;  // ← Ora el è definito
      
      log('Generazione: backdoorPct='+backdoorPct+', min='+minLen+', max='+maxLen+', diagonalBias='+diagonalBiasPct+'%'); 
      console.log('Params:', {backdoorPct, minLen, maxLen, diagonalBiasPct});
      
      let success=false; 
      let last=null; 
      
      for(let i=1;i<=attemptsMax;i++){ 
        console.log(`Tentativo ${i}/30 (bias: ${diagonalBiasPct}%)`);  // ← Log bias per traccia
        const g = makeGraph({backdoorPct, minLen, maxLen, diagonalBiasPct, CONE_DEPTH:2, CONE_ANGLE:80}); 
        console.log('Graph generated:', g ? 'OK' : 'NULL');
        pruneBackdoorsByHop(g,minLen,maxLen); 
        const check = checkBackdoorValidity(g,minLen,maxLen); 
        console.log('Check failures:', check.failures.length, check.failures);
        
        if(check.failures.length===0){ 
          currentGraph = g; 
          success=true; 
          last=check; 
          console.log('SUCCESS! Graph set.');
          break; 
        } else { 
          log('Tentativo '+i+' fallito: '+check.failures.join('; ')); 
          last = check; 
        } 
      }
      
      if(success){ 
        currentPlayerPos = currentGraph.nodes.find(n=>n.type==='start').id; 
        console.log('Player pos set:', currentPlayerPos);
      } 
      
      if(!success){ 
        log('Nessun grafo valido entro '+attemptsMax+' tentativi. Ultimi errori: '+last.failures.join('; ')); 
        console.log('No success, last check:', last);
        return; 
      } 
      
      console.log('Calling draw with graph:', currentGraph);
      draw(canvas, ctx, currentGraph, currentPlayerPos, null, 0);
      console.log('Draw called.');
      log('Grafo valido generato.');
      
      // ← Fix: log % diagonali qui, dopo success (su graph valido)
      const diagCount = currentGraph.edges.filter(e => {
        const a = currentGraph.nodes.find(n => n.id === e.from);
        const b = currentGraph.nodes.find(n => n.id === e.to);
        if (!a || !b) return false;
        const dx = Math.abs(a.x - b.x) > 5;
        const dy = Math.abs(a.y - b.y) > 5;  // ← Fix: a.y - b.y
        return dx && dy;
      }).length;
      const pctDiag = (diagCount / currentGraph.edges.length * 100).toFixed(0);
      log(`% Diagonali: ${pctDiag}% (bias: ${diagonalBiasPct}%)`);
      
    } catch (error) {  // ← Fix: cattura e logga errori
      console.error('Errore in generazione:', error);
      log('Errore: ' + error.message);
    }
  });

  // Handler Gioca Run (dal tuo originale, con fix playTrace)
  simBtn.addEventListener('click', () => {
    if (!currentGraph) {
      alert('Genera prima un grafo valido');
      return;
    }
    const res = simulateTrace(currentGraph);
    if (res.outcome === 'victory') log('Victory in ' + res.turns + ' turns');
    else if (res.outcome === 'captured') log('Captured in ' + res.turns + ' turns');
    else log('Timeout');
    playbackTrace = res.trace;
    playbackTimer = playTrace(playbackTrace, canvas, ctx, currentGraph, currentPlayerPos, playbackTimer);  // Ora passa currentPlayerPos, ma draw lo ignora in playback
  });

  // Aggiungi dopo simBtn
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Salva Grafo';
  saveBtn.className = 'btn';
  saveBtn.addEventListener('click', () => {
    if (!currentGraph) return alert('Genera prima!');
    const dataStr = JSON.stringify(currentGraph, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-map.json';
    a.click();
  });
  simBtn.parentNode.appendChild(saveBtn);  // Aggiunge bottone al div

  // Init draw e log (dal tuo originale)
  draw(canvas, ctx, currentGraph, currentPlayerPos, null, 0);
  log('Interfaccia pronta. Premi Genera & Valida.');
  console.log('initUI complete');  // Debug fine
}