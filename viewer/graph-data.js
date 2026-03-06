/**
 * Graph data state and operations.
 * This is the single source of truth for graph data in the viewer.
 */

let graphData = null;

const STATUS_COLOURS = {
  untested:   { bg: '#3a3a4a', fg: '#9999aa', css: 'var(--status-untested-bg)' },
  weak:       { bg: '#e5484d', fg: '#ffffff', css: 'var(--status-weak-bg)' },
  developing: { bg: '#f5a623', fg: '#1a1a2e', css: 'var(--status-developing-bg)' },
  solid:      { bg: '#46a758', fg: '#ffffff', css: 'var(--status-solid-bg)' },
  mastered:   { bg: '#3e63dd', fg: '#ffffff', css: 'var(--status-mastered-bg)' },
};

const STATUSES = ['untested', 'weak', 'developing', 'solid', 'mastered'];
const PASSED = new Set(['solid', 'mastered']);

function computeFrontier(nodes) {
  const frontier = new Set();
  for (const [id, node] of Object.entries(nodes)) {
    const status = node.status || 'untested';
    if (PASSED.has(status)) continue;
    const prereqs = node.prerequisites || [];
    const allPassed = prereqs.every(
      p => PASSED.has((nodes[p] || {}).status || 'untested')
    );
    if (allPassed) frontier.add(id);
  }
  return frontier;
}

function getDependents(nodeId) {
  if (!graphData) return [];
  return Object.entries(graphData.nodes)
    .filter(([_, n]) => (n.prerequisites || []).includes(nodeId))
    .map(([id]) => id);
}

function getDepth(nodeId, visited = new Set()) {
  if (!graphData || visited.has(nodeId)) return 0;
  visited.add(nodeId);
  const node = graphData.nodes[nodeId];
  if (!node || !node.prerequisites || node.prerequisites.length === 0) return 0;
  return 1 + Math.max(
    ...node.prerequisites.map(p => getDepth(p, new Set(visited)))
  );
}

function getStats() {
  if (!graphData) return {};
  const counts = {};
  for (const s of STATUSES) counts[s] = 0;
  for (const node of Object.values(graphData.nodes)) {
    const s = node.status || 'untested';
    counts[s] = (counts[s] || 0) + 1;
  }
  counts.total = Object.keys(graphData.nodes).length;
  counts.frontier = computeFrontier(graphData.nodes).size;
  return counts;
}
