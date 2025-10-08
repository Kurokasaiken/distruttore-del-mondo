// ===============================
// ui-handlers.js - UI-Specific Graph Handlers
// ===============================

import { makeGraph, pruneBackdoorsByHop, checkBackdoorValidity, logPercentDiagonal, initPatrolsAndHighlight } from './graph.js';
import { config } from './config.js';

export async function generateAndValidate(params, maxAttempts = 30) {
  const failures = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[GenerateAndValidate] Attempt ${attempt + 1}/${maxAttempts}`);
    const graph = makeGraph(params);
    pruneBackdoorsByHop(graph, params.minLen, params.maxLen);
    const valid = checkBackdoorValidity(graph, params.minLen, params.maxLen);
    if (valid) return { success: true, graph, last: { failures: [] } };
    failures.push(`Attempt ${attempt + 1}: ${graph.params.backdoorValidation.failures.join('; ')}`);
  }
  return { success: false, last: { failures }, graph: null };
}

// Re-export core per UI
export { logPercentDiagonal, initPatrolsAndHighlight };