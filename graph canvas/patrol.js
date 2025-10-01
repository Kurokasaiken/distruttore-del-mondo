// patrol.js
// spawn: 1 patrol per region initially (not within MIN_SPAWN_FROM_START hops of start)
const MIN_SPAWN_FROM_START = 6; // cannot spawn within 6 hops of start initial constraint
const MIN_SPAWN_FROM_PLAYER = 2; // cannot spawn within 2 hops of player
// For perception cone, we'll use CONE_DEPTH and CONE_ANGLE from graph.params when present

function buildAdjMap(graph){
  const adj={}; graph.nodes.forEach(n=>adj[n.id]=new Set());
  graph.edges.forEach(e=>{ adj[e.from].add(e.to); adj[e.to].add(e.from); });
  return adj;
}

function initialPatrols(graph){
  const nodes = graph.nodes;
  const adj = buildAdjMap(graph);
  // find start node id
  const startNode = nodes.find(n=>n.type==='start').id;
  const distFromStart = bfsHopArray(adj, startNode);
  const patrols=[];
  for(let r=0;r<NUM_REGIONS;r++){
    const cand = nodes.filter(n=>n.region===r && distFromStart[n.id]!==undefined && distFromStart[n.id]>=MIN_SPAWN_FROM_START).map(n=>n.id);
    // fallback: if none satisfy distance, accept any node in region
    const pickList = cand.length? cand : nodes.filter(n=>n.region===r).map(n=>n.id);
    if(pickList.length) patrols.push({pos:pickList[Math.floor(Math.random()*pickList.length)], prev:null, intent:null});
  }
  return patrols;
}

// BFS helper returning distances map
function bfsHopArray(adj, start){
  const q=[start]; const dist={}; dist[start]=0;
  while(q.length){
    const v=q.shift();
    for(const nb of adj[v]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb); }
  }
  return dist;
}

// compute cone nodes from patrol pos and prev (direction)
function coneNodesFromPatrol(graph, patrol, coneDepth=2, coneAngle=80){
  const adj = buildAdjMap(graph);
  const coords={}; graph.nodes.forEach(n=>coords[n.id]={x:n.x,y:n.y});
  const center = patrol.pos;
  let dir={x:0,y:-1};
  if(patrol.prev!==null && patrol.prev!==undefined){
    const a = coords[center], b=coords[patrol.prev];
    dir={x:a.x-b.x, y:a.y-b.y}; const m=Math.hypot(dir.x,dir.y)||1; dir.x/=m; dir.y/=m;
  } else {
    const nb = Array.from(adj[center]);
    if(nb.length>0){ const nn = coords[nb[0]]; const a=coords[center]; dir={x:nn.x-a.x, y:nn.y-a.y}; const m=Math.hypot(dir.x,dir.y)||1; dir.x/=m; dir.y/=m; }
  }
  const q=[{id:center, depth:0}]; const seen=new Set([center]); const out=new Set();
  while(q.length){
    const it=q.shift(); const node=it.id;
    const vec={x: coords[node].x - coords[center].x, y: coords[node].y - coords[center].y};
    const mag=Math.hypot(vec.x,vec.y)||1; const dot=(vec.x*dir.x+vec.y*dir.y)/mag;
    const angleDeg = Math.acos(Math.max(-1,Math.min(1,dot))) * 180/Math.PI;
    if(angleDeg <= coneAngle/2) out.add(node);
    if(it.depth < coneDepth){
      for(const nb of Array.from(adj[it.id])) if(!seen.has(nb)){ seen.add(nb); q.push({id:nb, depth: it.depth+1}); }
    }
  }
  return Array.from(out);
}

// update patrols per turn: set intent (if sees player change intent), move 1 hop toward intent next turn
function updatePatrolsPerTurn(graph, patrols, playerPos){
  const adj = buildAdjMap(graph);
  const coneDepth = graph.params.CONE_DEPTH || 2;
  const coneAngle = graph.params.CONE_ANGLE || 80;
  const coords={}; graph.nodes.forEach(n=>coords[n.id]={x:n.x,y:n.y});
  // determine nextIntent based on cone
  for(const p of patrols){
    p.nextIntent = null;
    const cone = coneNodesFromPatrol(graph, p, coneDepth, coneAngle);
    if(cone.includes(playerPos)) p.nextIntent = playerPos;
  }
  // apply immediate intent change (as requested): change immediately, movement happens in movement step
  for(const p of patrols){ if(p.nextIntent!==null) p.intent = p.nextIntent; }
  // move 1 hop toward intent (shortest path)
  for(const p of patrols){
    p.prev = p.pos;
    if(p.intent===null){ // wander
      const nb = Array.from(adj[p.pos]); if(nb.length>0) p.pos = nb[Math.floor(Math.random()*nb.length)];
    } else {
      const dist = bfsHopArray(adj, p.intent);
      const nb = Array.from(adj[p.pos]);
      if(nb.length>0){
        nb.sort((a,b)=> (dist[a]||999)-(dist[b]||999));
        p.pos = nb[0];
      }
    }
  }
  return patrols;
}

// spawn new patrol in region if allowed (respect min distance from player)
function spawnPatrolInRegion(graph, regionId, playerPos){
  const adj = buildAdjMap(graph);
  const distFromPlayer = bfsHopArray(adj, playerPos);
  const nodesInRegion = graph.nodes.filter(n=>n.region===regionId).map(n=>n.id);
  const candidates = nodesInRegion.filter(id => (distFromPlayer[id]===undefined || distFromPlayer[id]>=MIN_SPAWN_FROM_PLAYER));
  if(candidates.length===0) return null;
  return {pos:candidates[Math.floor(Math.random()*candidates.length)], prev:null, intent:null};
}

// despawn nearest patrol to player
function despawnNearestPatrol(patrols, graph, playerPos){
  const adj = buildAdjMap(graph);
  const dist = bfsHopArray(adj, playerPos);
  let bestIdx=null, bestD=Infinity;
  for(let i=0;i<patrols.length;i++){
    const dcur = dist[patrols[i].pos]===undefined?999:dist[patrols[i].pos];
    if(dcur < bestD){ bestD = dcur; bestIdx = i; }
  }
  if(bestIdx!==null) patrols.splice(bestIdx,1);
  return patrols;
}
