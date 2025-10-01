// draw.js
export function drawGraph(graph) {
  const canvas = document.getElementById('graphCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!graph || !graph.nodes) return;

  ctx.strokeStyle = '#999';
  graph.edges.forEach(e => {
    const n1 = graph.nodes[e.source];
    const n2 = graph.nodes[e.target];
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();
  });

  graph.nodes.forEach(n => {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = n.isPlayer ? 'gold' : 'skyblue';
    ctx.fill();
    ctx.stroke();
  });
}
