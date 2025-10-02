import { REG_COLS, START_REGION, GOAL_REGION } from './graph.js';

// prune backdoors by hop distance
export function pruneBackdoorsByHop(graph, minLen, maxLen){
  const nodes = graph.nodes; const edges = graph.edges.slice();
  
  // build adjacency map excluding backdoors
  const adjNoBack = {}; nodes.forEach(n => adjNoBack[n.id] = new Set());
  edges.forEach(e => { if(e.type && e.type === 'backdoor') return; adjNoBack[e.from].add(e.to); adjNoBack[e.to].add(e.from); });
  
  // helper BFS function
  function bfsNoBack(a,b){
    const q=[a]; const dist={}; dist[a]=0;
    while(q.length){ const v=q.shift(); if(v===b) return dist[v]; for(const nb of adjNoBack[v]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb); } }
    return Infinity;
  }
  
  // filter edges based on hop distance
  const filtered = [];
  for(const e of edges){
    if(!(e.type && e.type === 'backdoor')){ filtered.push(e); }
    else{
      const hops = bfsNoBack(e.from,e.to);
      if(hops !== Infinity && hops >= minLen && hops <= maxLen) filtered.push(e);
    }
  }
  graph.edges = filtered;
}

// Aggiunge backdoor agli edges secondo i parametri richiesti
export function addBackdoors(nodes, regions, edges, backdoorPct, minLen, maxLen) {
  // Puoi adattare la logica qui secondo la tua buildEdges, ma solo per la parte backdoor
  // Qui si assume che edges sia già popolato con archi normali
  // Restituisce un nuovo array edges con backdoor aggiunte

  // ...implementazione semplificata...
  // (Qui puoi incollare la tua logica di selezione candidati e aggiunta backdoor)
  // Per esempio:
  // - calcola candidati border
  // - seleziona coppie valide
  // - aggiungi edge {from, to, type:'backdoor'} a edges

  // Esempio placeholder (da sostituire con la tua logica reale):
  // return edges.concat([{from: 0, to: 1, type: 'backdoor'}]);
  return edges; // placeholder: nessuna backdoor aggiunta
}

// backdoor validity check
export function checkBackdoorValidity(graph, minLen=3, maxLen=6){
  if(!graph) return {failures:['no graph']};
  const nodes = graph.nodes; const edges = graph.edges;
  const backdoors = edges.filter(e=>e.type && e.type === 'backdoor');
  const failures=[];
  if(backdoors.length===0) failures.push('No backdoors generated');

  // no endpoint in start region
  backdoors.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from), b = nodes.find(n=>n.id===e.to);
    if(a.region===START_REGION || b.region===START_REGION) failures.push('Backdoor endpoint in start region: '+e.from+'-'+e.to);
  });

  // forward/lateral split
  function rDist(r){ const rr=Math.floor(r/REG_COLS), rc=r%REG_COLS; const gr=Math.floor(GOAL_REGION/REG_COLS), gc=GOAL_REGION%REG_COLS; return Math.abs(rr-gr)+Math.abs(rc-gc); }
  let forward=0, lateral=0;
  backdoors.forEach(e=>{ const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to); const da=rDist(a.region), db=rDist(b.region); if(da===db) lateral++; else forward++; });
  const total = backdoors.length; const forwardPct = total? Math.round(forward/total*100):0; const lateralPct = total? Math.round(lateral/total*100):0;
  if(total>0 && Math.abs(forwardPct-50)>10) failures.push('Forward/Lateral split out of ±10%: forward '+forwardPct+'% lateral '+lateralPct+'%');

  // hop-length ignoring backdoors
  const adjNoBack={}; nodes.forEach(n=>adjNoBack[n.id]=new Set());
  edges.forEach(e=>{ if(e.type && e.type === 'backdoor') return; adjNoBack[e.from].add(e.to); adjNoBack[e.to].add(e.from); });
  function bfsNoBack(a,b){
    const q=[a]; const dist={}; dist[a]=0;
    while(q.length){ const v=q.shift(); if(v===b) return dist[v]; for(const nb of adjNoBack[v]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb); } }
    return Infinity;
  }
  backdoors.forEach(e=>{ const hops=bfsNoBack(e.from,e.to); if(hops===Infinity) failures.push('Backdoor disconnected: '+e.from+'-'+e.to); if(hops<minLen) failures.push('Backdoor shorter than min: hops='+hops+' '+e.from+'-'+e.to); if(hops>maxLen) failures.push('Backdoor longer than max: hops='+hops+' '+e.from+'-'+e.to); });

  return {total:total, forward:forward, lateral:lateral, forwardPct:forwardPct, lateralPct:lateralPct, failures:failures};
}

// articulation points (for choke detection)
export function articulationPoints(nodes, edges){
  const adj={}; nodes.forEach(n=>adj[n.id]=[]);
  edges.forEach(e=>{ adj[e.from].push(e.to); adj[e.to].push(e.from); });
  const disc={}, low={}, parent={}, ap=new Set(); let time=0;
  function dfs(u){
    disc[u]=low[u]=++time; let child=0;
    for(const v of adj[u]){
      if(disc[v]===undefined){ parent[v]=u; child++; dfs(v); low[u]=Math.min(low[u], low[v]); if(parent[u]===undefined && child>1) ap.add(u); if(parent[u]!==undefined && low[v]>=disc[u]) ap.add(u); }
      else if(v!==parent[u]) low[u]=Math.min(low[u], disc[v]);
    }
  }
  for(const n of nodes) if(disc[n.id]===undefined) dfs(n.id);
  return Array.from(ap);
}

// fix choke points: add short inter-region bridges (best-effort)
export function fixChokePoints(graph, limit=2){
  let attempts=0;
  while(attempts<200){
    const aps = articulationPoints(graph.nodes, graph.edges);
    if(aps.length<=limit) return {fixed:true, attempts, articulationCount:aps.length};
    // add a short inter-region edge between nodes in different regions to create alternative routes
    const adjSet = new Set(graph.edges.map(e=> e.from<e.to? e.from+','+e.to : e.to+','+e.from));
    const candidates=[];
    for(let i=0;i<graph.nodes.length;i++) for(let j=i+1;j<graph.nodes.length;j++){
      const key=i+','+j; if(adjSet.has(key)) continue;
      const ni=graph.nodes[i], nj=graph.nodes[j]; if(ni.region===nj.region) continue;
      const d=Math.hypot(ni.x-nj.x, ni.y-nj.y);
      candidates.push({i,j,d});
    }
    if(candidates.length===0) break;
    candidates.sort((a,b)=>a.d-b.d);
    const pick = candidates[Math.floor(Math.random()*Math.min(60,candidates.length))];
    graph.edges.push({from:pick.i,to:pick.j,type:'inter'}); attempts++;
  }
  return {fixed:false, attempts, articulationCount: articulationPoints(graph.nodes, graph.edges).length};
}
