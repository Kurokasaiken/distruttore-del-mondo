// graph.js
const TOTAL_NODES = 150;
const REG_ROWS = 3, REG_COLS = 3, NUM_REGIONS = REG_ROWS*REG_COLS;
const START_REGION = 3, GOAL_REGION = 5; // B1 (index 3), B3 (index 5)
let currentGraph = null;

// Genera regioni 3x3 (rect contigui), scala espansa
function generateRegions(cell=180, scale=1.25){
  const regs=[];
  const w=cell*scale, h=cell*scale;
  for(let r=0;r<REG_ROWS;r++){
    for(let c=0;c<REG_COLS;c++){
      const id=r*REG_COLS+c;
      const x0=c*w, y0=r*h;
      regs.push({id:id, name:String.fromCharCode(65+r)+(c+1), bbox:{x0,y0,x1:x0+w,y1:y0+h}, seed:[x0+w/2,y0+h/2]});
    }
  }
  return regs;
}

// Distribuzione nodi snap-to-grid dentro ogni bbox, ~17 per regione
function distributeNodes(regions){
  const base = Math.floor(TOTAL_NODES/regions.length);
  const counts = new Array(regions.length).fill(base);
  let rem = TOTAL_NODES - counts.reduce((a,b)=>a+b,0);
  let idx=0; while(rem>0){ counts[idx%regions.length]++; idx++; rem--; }
  const nodes=[]; let id=0;
  for(let rid=0; rid<regions.length; rid++){
    const cnt = counts[rid]; const bb=regions[rid].bbox; const margin=10;
    const innerW=bb.x1-bb.x0-2*margin, innerH=bb.y1-bb.y0-2*margin;
    const cols = Math.max(1, Math.round(Math.sqrt(cnt*(innerW/innerH))));
    const rows = Math.max(1, Math.ceil(cnt/cols));
    const spacingX = innerW/cols, spacingY = innerH/rows;
    let placed=0;
    for(let r=0;r<rows && placed<cnt;r++){
      for(let c=0;c<cols && placed<cnt;c++){
        const cx = bb.x0+margin+(c+0.5)*spacingX;
        const cy = bb.y0+margin+(r+0.5)*spacingY;
        const jitterX = (Math.random()-0.5)*Math.min(spacingX*0.18,8);
        const jitterY = (Math.random()-0.5)*Math.min(spacingY*0.18,8);
        nodes.push({id:id,x:Math.round(cx+jitterX),y:Math.round(cy+jitterY),region:rid,type:'normal'}); id++; placed++;
      }
    }
    while(placed<cnt){ const x=Math.round(Math.random()*(bb.x1-bb.x0-24)+bb.x0+12); const y=Math.round(Math.random()*(bb.y1-bb.y0-24)+bb.y0+12); nodes.push({id:id,x,y,region:rid,type:'normal'}); id++; placed++; }
  }
  while(nodes.length<TOTAL_NODES){ const r=Math.floor(Math.random()*regions.length); const bb=regions[r].bbox; nodes.push({id:nodes.length,x:Math.round(Math.random()*(bb.x1-bb.x0-24)+bb.x0+12),y:Math.round(Math.random()*(bb.y1-bb.y0-24)+bb.y0+12),region:r,type:'normal'}); }
  nodes.forEach((n,i)=>n.id=i);
  return nodes;
}

// Build edges: intra-region MST + k-nearest extras, inter-region adjacencies, backdoors with constraints
function buildEdges(nodes, regions, backdoorPct=8, minLen=3, maxLen=6){
  const coord={}; nodes.forEach(n=>coord[n.id]=n);
  const edgesMap={};
  function addEdge(a,b,type){ if(a===b) return; const key = a<b? a+','+b : b+','+a; if(!edgesMap[key]) edgesMap[key]={from:Math.min(a,b),to:Math.max(a,b),type:type||'intra'}; }

  // group by region
  const byRegion={}; nodes.forEach(n=>{ byRegion[n.region]=byRegion[n.region]||[]; byRegion[n.region].push(n); });

  // MST per region (Prim)
  for(const rid in byRegion){
    const list = byRegion[rid]; if(!list||list.length===0) continue;
    const used = new Set(); const rem = new Set(list.map(x=>x.id)); const first=list[0].id; used.add(first); rem.delete(first);
    while(rem.size>0){
      let bestD=Infinity, ba=null, bb=null;
      used.forEach(u=> rem.forEach(v=>{ const d=Math.hypot(coord[u].x-coord[v].x, coord[u].y-coord[v].y); if(d<bestD){ bestD=d; ba=u; bb=v; } }));
      if(ba!==null){ addEdge(ba,bb,'intra'); used.add(bb); rem.delete(bb); } else break;
    }
  }

  // local extras k-nearest
  const k_extra=2;
  nodes.forEach(n=>{
    const same = nodes.filter(m=>m.region===n.region && m.id!==n.id);
    same.sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));
    for(let i=0;i<Math.min(k_extra,same.length);i++) addEdge(n.id,same[i].id,'intra');
  });

  // inter-region adjacency (grid neighbors)
  const adjPairs=[];
  for(let r=0;r<NUM_REGIONS;r++){
    const rr=Math.floor(r/REG_COLS), rc=r%REG_COLS;
    [[0,1],[1,0]].forEach(d=>{ const nr=rr+d[0], nc=rc+d[1]; if(nr>=0 && nr<REG_ROWS && nc>=0 && nc<REG_COLS) adjPairs.push([r, nr*REG_COLS+nc]); });
  }
  adjPairs.forEach(pair=>{
    const [a,b]=pair;
    const A = nodes.filter(n=>n.region===a), B = nodes.filter(n=>n.region===b);
    if(A.length===0||B.length===0) return;
    const pairs=[];
    A.forEach(na=>B.forEach(nb=>pairs.push({a:na.id,b:nb.id,d:Math.hypot(na.x-nb.x,na.y-nb.y)})));
    pairs.sort((u,v)=>u.d-v.d);
    const num = Math.random()<0.5?1:(Math.random()<0.5?2:3);
    for(let i=0;i<num && i<pairs.length;i++) addEdge(pairs[i].a,pairs[i].b,'inter');
  });

  // BACKDOORS: select border candidates
  const num_backdoors = Math.max(1, Math.round((backdoorPct/100)*nodes.length));
  const mapBBox = {x0: Math.min(...regions.map(r=>r.bbox.x0)), y0: Math.min(...regions.map(r=>r.bbox.y0)), x1: Math.max(...regions.map(r=>r.bbox.x1)), y1: Math.max(...regions.map(r=>r.bbox.y1))};
  const borderCandidates = nodes.filter(n=>{
    if(n.region===START_REGION) return false;
    const rbb = regions[n.region].bbox;
    const padX=(rbb.x1-rbb.x0)*0.16, padY=(rbb.y1-rbb.y0)*0.16;
    const regDist = Math.min(Math.abs(n.x-rbb.x0),Math.abs(n.x-rbb.x1),Math.abs(n.y-rbb.y0),Math.abs(n.y-rbb.y1));
    const mapEdgeDist = Math.min(Math.abs(n.x-mapBBox.x0),Math.abs(n.x-mapBBox.x1),Math.abs(n.y-mapBBox.y0),Math.abs(n.y-mapBBox.y1));
    return regDist <= Math.max(padX,padY) || mapEdgeDist <= Math.max(padX,padY);
  });
  const candPairs = [];
  for(let i=0;i<borderCandidates.length;i++) for(let j=i+1;j<borderCandidates.length;j++){
    const A=borderCandidates[i], B=borderCandidates[j];
    if(A.region===B.region) continue;
    candPairs.push({a:A,b:B,d:Math.hypot(A.x-B.x,A.y-B.y)});
  }
  candPairs.sort((u,v)=>v.d-u.d);

  // build adjacency without backdoors
  const adjNoBack={}; nodes.forEach(n=>adjNoBack[n.id]=new Set());
  for(const k in edgesMap){} // edgesMap currently contains intra/inter we've added
  // populate adjNoBack from edgesMap
  for(const k in edgesMap){ const e = edgesMap[k]; if(!e) continue; adjNoBack[e.from].add(e.to); adjNoBack[e.to].add(e.from); }
  function bfsNoBack(a,b){
    const q=[a]; const dist={}; dist[a]=0;
    while(q.length){
      const v=q.shift();
      if(v===b) return dist[v];
      for(const nb of adjNoBack[v]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb); }
    }
    return Infinity;
  }
  function regionDistToGoal(region){ const rr=Math.floor(region/REG_COLS), rc=region%REG_COLS; const gr=Math.floor(GOAL_REGION/REG_COLS), gc=GOAL_REGION%REG_COLS; return Math.abs(rr-gr)+Math.abs(rc-gc); }
  const forwardTarget = Math.round(num_backdoors*0.5), lateralTarget = num_backdoors-forwardTarget; let f=0,l=0; const used=new Set();
  function regionRow(region){ return Math.floor(region/REG_COLS); }

  // pass 1: add backdoors satisfying hop-length and forward-only in rows A/C
  for(const p of candPairs){
    if(f>=forwardTarget && l>=lateralTarget) break;
    const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id;
    if(used.has(key)) continue;
    const hops = bfsNoBack(p.a.id,p.b.id); if(hops===Infinity) continue;
    if(hops < minLen || hops > maxLen) continue;
    const da=regionDistToGoal(p.a.region), db=regionDistToGoal(p.b.region); const isForward = Math.min(da,db) < Math.max(da,db);
    const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region);
    const forwardAllowed = isForward && rowA!==1 && rowB!==1; // only A or C rows
    if(forwardAllowed && f<forwardTarget){ addEdge(p.a.id,p.b.id,'backdoor'); used.add(key); f++; }
    else if(!isForward && l<lateralTarget){ addEdge(p.a.id,p.b.id,'backdoor'); used.add(key); l++; }
  }

  // pass 2: ponderated candidates (near the hop window)
  if(f + l < num_backdoors){
    const remaining = candPairs.filter(p=>{ const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id; return !used.has(key); }).map(p=>{ const hops = bfsNoBack(p.a.id,p.b.id); const diff = (hops===Infinity)? Infinity : (hops < minLen ? (minLen - hops) : (hops > maxLen ? hops - maxLen : 0)); return Object.assign({}, p, {hops, diff}); });
    remaining.sort((A,B)=>{ if(A.diff !== B.diff) return A.diff - B.diff; return B.d - A.d; });
    for(const p of remaining){
      if(f + l >= num_backdoors) break;
      if(p.hops===Infinity) continue;
      const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id;
      if(used.has(key)) continue;
      const da=regionDistToGoal(p.a.region), db=regionDistToGoal(p.b.region); const isForward = Math.min(da,db) < Math.max(da,db);
      const rowA = regionRow(p.a.region), rowB = regionRow(p.b.region); const forwardAllowed = isForward && rowA!==1 && rowB!==1;
      addEdge(p.a.id,p.b.id,'backdoor'); used.add(key);
      if(forwardAllowed) f++; else l++;
    }
  }

  // final fill if still short
  if(f + l < num_backdoors){
    const freeCandidates = candPairs.filter(p=>{ const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id; return !used.has(key); });
    for(const p of freeCandidates){
      if(f + l >= num_backdoors) break;
      const key = p.a.id<p.b.id? p.a.id+','+p.b.id : p.b.id+','+p.a.id;
      addEdge(p.a.id,p.b.id,'backdoor'); used.add(key);
      const da=regionDistToGoal(p.a.region), db=regionDistToGoal(p.b.region);
      if(Math.min(da,db) < Math.max(da,db)) f++; else l++;
    }
  }

  return Object.keys(edgesMap).map(k=>edgesMap[k]);
}

function makeGraph(params){
  const regions = generateRegions();
  const nodes = distributeNodes(regions);
  const edges = buildEdges(nodes, regions, params.backdoorPct, params.minLen, params.maxLen);
  function nearestInRegion(nodesArr, regionsArr, rid){
    const list = nodesArr.filter(n=>n.region===rid); let best=list[0], bd=1e9;
    list.forEach(n=>{ const d=Math.hypot(n.x-regionsArr[rid].seed[0], n.y-regionsArr[rid].seed[1]); if(d<bd){ bd=d; best=n; } });
    return best;
  }
  const s = nearestInRegion(nodes, regions, START_REGION); s.type='start';
  const g = nearestInRegion(nodes, regions, GOAL_REGION); g.type='goal';
  const graph = { meta:{total_nodes:TOTAL_NODES, regions:NUM_REGIONS, start_region:'B1', goal_region:'B3'}, regions:regions, nodes:nodes, edges:edges, params:params };
  currentGraph = graph;
  return graph;
}

function exportGraphJSON(){
  return currentGraph ? JSON.stringify(currentGraph, null, 2) : null;
}
