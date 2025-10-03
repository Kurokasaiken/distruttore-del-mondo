export function el(id) {
  return document.getElementById(id);
}

export function log(msg) {
  const logEl = el('log');
  if (logEl) {
    logEl.textContent += msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
}