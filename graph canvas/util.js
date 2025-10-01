function updateStats(msg) {
  const panel = document.getElementById("statsPanel");
  panel.innerHTML = `<p>${msg}</p>`;
}

function reduceChokePoints() {
  // TODO: implementa riduzione choke points
  updateStats("Riduzione choke points applicata.");
}
