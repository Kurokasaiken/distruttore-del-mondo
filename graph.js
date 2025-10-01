class GameMap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.nodes = [];
    this.edges = [];
    this.player = null;
    this.goal = null;
  }

  // --------------------------
  // 1) Generazione grafo
  // --------------------------
  generateGraph(nodeCount = 150) {
    this.nodes = [];
    this.edges = [];

    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        id: i,
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        region: this.assignRegion(i, nodeCount),
      });
    }

    this.generateEdges();
    this.placePlayerAndGoal();
  }

  assignRegion(i, total) {
    // Divide i nodi in “quartieri”
    const regions = ["rosso", "blu", "verde", "oro"];
    return regions[Math.floor((i / total) * regions.length)];
  }

  generateEdges() {
    this.nodes.forEach((node) => {
      let targets = this.nodes
        .filter((n) => n !== node)
        .sort((a, b) => this.dist(node, a) - this.dist(node, b))
        .slice(0, 3); // collega ai 3 più vicini

      targets.forEach((t) => {
        this.edges.push({ from: node.id, to: t.id });
      });
    });
  }

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  placePlayerAndGoal() {
    this.player = this.nodes[0]; // primo nodo
    this.goal = this.nodes[this.nodes.length - 1]; // ultimo nodo
  }

  // --------------------------
  // 2) Simulazione
  // --------------------------
  movePlayer() {
    // sposta il player lungo un arco a caso
    const edges = this.edges.filter((e) => e.from === this.player.id);
    if (edges.length > 0) {
      const next = edges[Math.floor(Math.random() * edges.length)].to;
      this.player = this.nodes[next];
    }
  }

  isAtGoal() {
    return this.player.id === this.goal.id;
  }

  // --------------------------
  // 3) Rendering
  // --------------------------
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // archi
    this.ctx.strokeStyle = "#999";
    this.edges.forEach((e) => {
      let a = this.nodes[e.from];
      let b = this.nodes[e.to];
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();
    });

    // nodi
    this.nodes.forEach((n) => {
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, 5, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.colorRegion(n.region);
      this.ctx.fill();
    });

    // goal
    this.ctx.beginPath();
    this.ctx.arc(this.goal.x, this.goal.y, 8, 0, 2 * Math.PI);
    this.ctx.fillStyle = "green";
    this.ctx.fill();

    // player
    this.ctx.beginPath();
    this.ctx.arc(this.player.x, this.player.y, 8, 0, 2 * Math.PI);
    this.ctx.fillStyle = "gold";
    this.ctx.fill();
  }

  colorRegion(region) {
    switch (region) {
      case "rosso":
        return "red";
      case "blu":
        return "blue";
      case "verde":
        return "limegreen";
      case "oro":
        return "orange";
      default:
        return "gray";
    }
  }

  // --------------------------
  // 4) Loop di gioco
  // --------------------------
  runStep() {
    this.movePlayer();
    this.render();

    if (this.isAtGoal()) {
      console.log("Raggiunta la torre!");
    }
  }
}
