// graph.js
export const TOTAL_NODES = 150;
export const REG_ROWS = 3, REG_COLS = 3, NUM_REGIONS = REG_ROWS*REG_COLS;
export const START_REGION = 3, GOAL_REGION = 5; // B1 (index 3), B3 (index 5)
export let currentGraph = null;

// Genera regioni 3x3 (rect contigui), scala espansa
export function generateRegions(cell=160, scale=1.25) {
  const REG_ROWS = 3, REG_COLS = 3;
  const regs = [];
  const w = cell * scale, h = cell * scale;
  for (let r = 0; r < REG_ROWS; r++)
    for (let c = 0; c < REG_COLS; c++) {
      const id = r * REG_COLS + c;
      const x0 = c * w, y0 = r * h;
      regs.push({
        id: id,
        name: String.fromCharCode(65 + r) + String(c + 1),
        bbox: { x0: x0, y0: y0, x1: x0 + w, y1: y0 + h },
        seed: [x0 + w / 2, y0 + h / 2]
      });
    }
  return regs;
}

// Distribuzione nodi snap-to-grid dentro ogni bbox
export function distributeNodes(regions) {
  const TOTAL_NODES = 150;
  const base = Math.floor(TOTAL_NODES / regions.length);
  const counts = new Array(regions.length).fill(base);
  let rem = TOTAL_NODES - counts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (rem > 0) { counts[idx % regions.length]++; idx++; rem--; }
  const nodes = [];
  let id = 0;
  for (let rid = 0; rid < regions.length; rid++) {
    const cnt = counts[rid];
    const bb = regions[rid].bbox;
    const margin = 12;
    const innerW = bb.x1 - bb.x0 - 2 * margin;
    const innerH = bb.y1 - bb.y0 - 2 * margin;
    const cols = Math.max(1, Math.round(Math.sqrt(cnt * (innerW / innerH))));
    const rows = Math.max(1, Math.ceil(cnt / cols));
    const spacingX = innerW / cols;
    const spacingY = innerH / rows;
    let placed = 0;
    for (let r = 0; r < rows && placed < cnt; r++) {
      for (let c = 0; c < cols && placed < cnt; c++) {
        const cx = bb.x0 + margin + (c + 0.5) * spacingX;
        const cy = bb.y0 + margin + (r + 0.5) * spacingY;
        const jitterX = (Math.random() - 0.5) * Math.min(spacingX * 0.18, 6);
        const jitterY = (Math.random() - 0.5) * Math.min(spacingY * 0.18, 6);
        const x = Math.round(cx + jitterX), y = Math.round(cy + jitterY);
        nodes.push({ id: id, x: x, y: y, region: rid, type: 'normal' });
        id++; placed++;
      }
    }
    while (placed < cnt) {
      const x = Math.round(Math.random() * (bb.x1 - bb.x0 - 24) + bb.x0 + 12);
      const y = Math.round(Math.random() * (bb.y1 - bb.y0 - 24) + bb.y0 + 12);
      nodes.push({ id: id, x: x, y: y, region: rid, type: 'normal' });
      id++; placed++;
    }
  }
  while (nodes.length < TOTAL_NODES) {
    const r = Math.floor(Math.random() * regions.length);
    const bb = regions[r].bbox;
    nodes.push({
      id: nodes.length,
      x: Math.round(Math.random() * (bb.x1 - bb.x0 - 24) + bb.x0 + 12),
      y: Math.round(Math.random() * (bb.y1 - bb.y0 - 24) + bb.y0 + 12),
      region: r,
      type: 'normal'
    });
  }
  nodes.forEach((n, i) => n.id = i);
  return nodes;
}

export function buildAdj(nodes, edges) {
  const adj = {};
  nodes.forEach(n => adj[n.id] = new Set());
  edges.forEach(e => {
    adj[e.from].add(e.to);
    adj[e.to].add(e.from);
  });
  return adj;
}

export function bfsHop(adj, a, b) {
  const q = [a];
  const dist = {};
  dist[a] = 0;
  while (q.length) {
    const v = q.shift();
    if (v === b) return dist[v];
    for (const nb of adj[v]) {
      if (dist[nb] === undefined) {
        dist[nb] = dist[v] + 1;
        q.push(nb);
      }
    }
  }
  return Infinity;
}

export function buildEdges(nodes, regions, backdoorPct, minLen, maxLen) {
  const coord={}; nodes.forEach(n=>coord[n.id]=n);
  const edgesMap={};
  function addEdge(a,b,type='intra') {
    if(a===b) return;
    const key=a<b? a+','+b : b+','+a;
    if(!edgesMap[key]) edgesMap[key]={from:Math.min(a,b),to:Math.max(a,b),type};
  }

  // MST per regione
  const byRegion={};
  nodes.forEach(n=>{ byRegion[n.region]=byRegion[n.region]||[]; byRegion[n.region].push(n); });
  for(const rid in byRegion) {
    const list=byRegion[rid];
    if(!list || list.length===0) continue;
    const used=new Set(); const rem=new Set(list.map(x=>x.id));
    const first=list[0].id; used.add(first); rem.delete(first);

    while(rem.size>0) {
      let bestD=Infinity, ba=null, bb=null;
      used.forEach(u=>rem.forEach(v=>{
        const d=Math.hypot(coord[u].x-coord[v].x, coord[u].y-coord[v].y);
        if(d<bestD) { bestD=d; ba=u; bb=v; }
      }));
      if(ba!==null) { addEdge(ba,bb,'intra'); used.add(bb); rem.delete(bb); } else break;
    }
  }

  // Local extras
  const k_extra=2;
  nodes.forEach(n=>{
    const same = nodes.filter(m=>m.region===n.region && m.id!==n.id);
    same.sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.b.y)-Math.hypot(b.x-n.x,b.y-n.y));
    for(let i=0;i<Math.min(k_extra,same.length);i++) addEdge(n.id,same[i].id,'intra');
  });

  // Inter-region adjacencies
  const adjPairs=[];
  for(let r=0;r<NUM_REGIONS;r++) {
    const rr=Math.floor(r/REG_COLS), rc=r%REG_COLS;
    [[0,1],[1,0]].forEach(d=>{
      const nr=rr+d[0], nc=rc+d[1];
      if(nr>=0 && nr<REG_ROWS && nc>=0 && nc<REG_COLS) adjPairs.push([r,nr*REG_COLS+nc]);
    });
  }

  adjPairs.forEach(pair=>{
    const [a,b]=pair;
    const A=nodes.filter(n=>n.region===a), B=nodes.filter(n=>n.region===b);
    if(A.length===0||B.length===0) return;
    const pairs=[]; A.forEach(na=>B.forEach(nb=>pairs.push({a:na.id,b:nb.id,d:Math.hypot(na.x-nb.x,na.y-nb.y)})));
    pairs.sort((u,v)=>u.d-v.d);
    const num = Math.random()<0.5?1:(Math.random()<0.5?2:3);
    for(let i=0;i<num && i<pairs.length;i++) addEdge(pairs[i].a,pairs[i].b,'inter');
  });

  // Backdoor candidates
  const num_backdoors = Math.max(1, Math.round((backdoorPct/100)*nodes.length));
  const mapBBox = {x0:Math.min(...regions.map(r=>r.bbox.x0)),y0:Math.min(...regions.map(r=>r.bbox.y0)),x1:Math.max(...regions.map(r=>r.bbox.x1)),y1:Math.max(...regions.map(r=>r.bbox.y1))};
  const borderCandidates = nodes.filter(n=>{
    if(n.region===START_REGION) return false;
    const rbb = regions[n.region].bbox;
    const padX=(rbb.x1-rbb.x0)*0.16, padY=(rbb.y1-rbb.y0)*0.16;
    const regDist = Math.min(Math.abs(n.x-rbb.x0),Math.abs(n.x-rbb.x1),Math.abs(n.y-rbb.y0),Math.abs(n.y-rbb.y1));
    const mapEdgeDist = Math.min(Math.abs(n.x-mapBBox.x0),Math.abs(n.x-mapBBox.x1),Math.abs(n.y-mapBBox.y0),Math.abs(n.y-mapBBox.y1));
    return regDist<=Math.max(padX,padY) || mapEdgeDist<=Math.max(padX,padY);
  });

  const candPairs=[];
  for(let i=0;i<borderCandidates.length;i++) {
    for(let j=i+1;j<borderCandidates.length;j++) {
      if(borderCandidates[i].region===borderCandidates[j].region) continue;
      candPairs.push({a:borderCandidates[i],b:borderCandidates[j],d:Math.hypot(borderCandidates[i].x-borderCandidates[j].x,borderCandidates[i].y-borderCandidates[j].y)});
    }
  }
  candPairs.sort((u,v)=>v.d-u.d);

  // Build adjacency without backdoors
  const adjNoBack = {};
  nodes.forEach(n=>adjNoBack[n.id]=new Set());
  Object.values(edgesMap).forEach(e=>{ adjNoBack[e.from].add(e.to); adjNoBack[e.to].add(e.from); });

  function bfsNoBack(a,b) {
    const q=[a]; const dist={}; dist[a]=0;
    while(q.length) {
      const v=q.shift();
      if(v===b) return dist[v];
      for(const nb of adjNoBack[v]) if(dist[nb]===undefined) { dist[nb]=dist[v]+1; q.push(nb); }
    }
    return Infinity;
  }

  // Backward adding strategy
  let f=0,l=0; const used=new Set();
  const forwardTarget = Math.round(num_backdoors*0.5);
  const lateralTarget = num_backdoors-forwardTarget;

  for(const p of candPairs) {
    if(f>=forwardTarget && l>=lateralTarget) break;
    const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id;
    if(used.has(key)) continue;
    const hops = bfsNoBack(p.a.id,p.b.id);
    if(hops<minLen || hops>maxLen) continue;
    const da=regionDistToGoal(p.a.region), db=regionDistToGoal(p.b.region);
    const isForward = Math.min(da,db)<Math.max(da,db);
    const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
    const forwardAllowed = isForward && rowA!==1 && rowB!==1;
    if(forwardAllowed && f<forwardTarget) { addEdge(p.a.id,p.b.id,'backdoor'); used.add(key); f++; }
    else if(!isForward && l<lateralTarget) { addEdge(p.a.id,p.b.id,'backdoor'); used.add(key); l++; }
  }

  return Object.keys(edgesMap).map(k=>edgesMap[k]);
}

// Nearest in region
export function nearestInRegion(nodesArr, regionsArr, rid) {
  const list = nodesArr.filter(n=>n.region===rid);
  if(list.length===0) return null;
  let best=list[0], bd=1e9;
  list.forEach(n=>{
    const d=Math.hypot(n.x-regionsArr[rid].seed[0], n.y-regionsArr[rid].seed[1]);
    if(d<bd){ bd=d; best=n; }
  });
  return best;
}

// Make graph
export function makeGraph(params) {
  const regions = generateRegions();
  const nodes = distributeNodes(regions);
  const edges = buildEdges(nodes, regions, params.backdoorPct||8, params.minLen||3, params.maxLen||6);

  const s = nearestInRegion(nodes, regions, START_REGION); if(s) s.type='start';
  const g = nearestInRegion(nodes, regions, GOAL_REGION); if(g) g.type='goal';

  const graph = {
    meta: { total_nodes: TOTAL_NODES, regions: NUM_REGIONS, start_region: 'B1', goal_region: 'B3' },
    regions, nodes, edges, params, success:true
  };

  currentGraph = graph;
  return graph;
}

// BFS hop distance helper
export function bfsHopSimple(adj, start) {
  const q=[start], dist={}; dist[start]=0;
  while(q.length) {
    const v=q.shift();
    for(const nb of adj[v]||[]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb);}
  }
  return dist;
}
