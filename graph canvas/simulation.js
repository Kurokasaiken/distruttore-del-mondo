// simulation.js
// simple BFS helper
function bfsHop(adj, start){
  const q=[start]; const dist={}; dist[start]=0;
  while(q.length){
    const v=q.shift();
    for(const nb of adj[v]) if(dist[nb]===undefined){ dist[nb]=dist[v]+1; q.push(nb); }
  }
  return dist;
}

function buildAdj(edges, nodes){
  const adj={}; nodes.forEach(n=>adj[n.id]=new Set());
  edges.forEach(e=>{ adj[e.from].add(e.to); adj[e.to].add(e.from); });
  return adj;
}

// Player greedy+risk AI: minimize hops to goal, maximize distance from patrols
function choosePlayerMove(playerPos, adj, dToGoal, patrolPositions){
  const options = Array.from(adj[playerPos]); options.push(playerPos);
  function nearestPatrol(node){
    const d = bfsHop(adj, node);
    let m=Infinity;
    for(const p of patrolPositions) if(d[p]!==undefined) m = Math.min(m, d[p]);
    return m;
  }
  let best=null, bestScore=-Infinity;
  for(const opt of options){
    const h = dToGoal[opt]===undefined?999:dToGoal[opt];
    const pd = nearestPatrol(opt);
    const score = (pd*0.6) - (h*1.0);
    if(score>bestScore){ bestScore=score; best=opt; }
  }
  return best;
}

// simulate one run: returns outcome, turns, trace
function simulateTrace(graph, maxTurns=150){
  if(!graph) return {outcome:'invalid'};
  const nodes = JSON.parse(JSON.stringify(graph.nodes));
  const edges = graph.edges.slice();
  const adj = buildAdj(edges, nodes);
  const start = nodes.find(n=>n.type==='start').id;
  const goal = nodes.find(n=>n.type==='goal').id;

  // patrols initial: 1 per region, respecting min spawn from start
  let patrols = initialPatrols(graph);

  let alert = 1; // global alert
  let playerPos = start;
  const visited = new Set([playerPos]);
  const trace = [{player:playerPos, patrols:patrols.map(p=>({pos:p.pos,prev:p.prev})), alert}];

  for(let t=1;t<=maxTurns;t++){
    // player move
    const dToGoal = bfsHop(adj, playerPos);
    const patrolPositions = patrols.map(p=>p.pos);
    const next = choosePlayerMove(playerPos, adj, dToGoal, patrolPositions);
    playerPos = next;
    visited.add(playerPos);

    // alert random roll (10% +1, 5% -1)
    const r = Math.floor(Math.random()*100)+1;
    const prevAlert = alert;
    if(r>=91) alert = Math.min(5, alert+1);
    else if(r<=5) alert = Math.max(1, alert-1);

    // spawn on increase: generate at least one new patrol (if alert increased) - pick region(s) probabilistically but enforce distance >= MIN_SPAWN_FROM_PLAYER
    if(alert > prevAlert){
      // pick a region randomly and try to spawn (best-effort), not nearer than MIN_SPAWN_FROM_PLAYER to player
      for(let rg=0; rg<NUM_REGIONS; rg++){
        if(Math.random() < 0.12){ // small chance per region to spawn (event triggered by alert)
          const p = spawnPatrolInRegion(graph, rg, playerPos);
          if(p) patrols.push(p);
        }
      }
    }

    // on decrease: despawn nearest patrol
    if(alert < prevAlert && patrols.length>0) patrols = despawnNearestPatrol(patrols, graph, playerPos);

    // patrols update: compute cone and intent then move
    updatePatrolsPerTurn(graph, patrols, playerPos);

    trace.push({player:playerPos, patrols:patrols.map(p=>({pos:p.pos,prev:p.prev})), alert});

    // capture check
    if(patrols.some(pp=>pp.pos===playerPos)) return {outcome:'captured', turns:t, trace, visitedCount: visited.size};
    if(playerPos===goal) return {outcome:'victory', turns:t, trace, visitedCount: visited.size};
  }
  return {outcome:'timeout', turns:maxTurns, trace, visitedCount: visited.size};
}

// batch evaluation (N simulations)
function evaluateGraph(graph, sims=100){
  const results = [];
  for(let i=0;i<sims;i++){
    results.push(simulateTrace(graph));
  }
  const wins = results.filter(r=>r.outcome==='victory');
  const caps = results.filter(r=>r.outcome==='captured');
  const tos = results.filter(r=>r.outcome==='timeout');
  const stats = {
    total: sims,
    victory_within80: (wins.filter(w=>w.turns<=80).length/sims)*100,
    victory_over80: (wins.filter(w=>w.turns>80).length/sims)*100,
    avg_turns_victory: wins.length? Math.round(wins.reduce((a,b)=>a+b.turns,0)/wins.length):null,
    min_steps_victory: wins.length? Math.min(...wins.map(w=>w.turns)):null,
    capture_pct: (caps.length/sims)*100,
    timeout_pct: (tos.length/sims)*100,
    avg_nodes_visited_on_victory: wins.length? Math.round(wins.reduce((a,b)=>a+b.visitedCount,0)/wins.length):null
  };
  return {stats, results};
}
