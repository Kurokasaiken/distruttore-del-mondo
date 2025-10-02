export function el(id) {
  return document.getElementById(id);
}

export function log(s) {
  const logEl = el('log');
  if (logEl) {
    logEl.textContent = new Date().toISOString().slice(11,19)+' — '+s+'\n'+logEl.textContent;
  }
}
