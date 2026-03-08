/**
 * Graph data state and operations.
 * This is the single source of truth for graph data in the viewer.
 */

var graphData = null;
var graphFilePath = null; // set from ?graph= param, used for auto-save

// Default status scheme — used when graph JSON has no "statuses" key
const DEFAULT_STATUSES = [
  { id: 'untested',   label: 'Untested',   color: '#3a3a4a' },
  { id: 'weak',       label: 'Weak',       color: '#e5484d' },
  { id: 'developing', label: 'Developing', color: '#f5a623' },
  { id: 'solid',      label: 'Solid',      color: '#46a758' },
  { id: 'mastered',   label: 'Mastered',   color: '#3e63dd' },
];

const DEFAULT_PASSED = new Set(['solid', 'mastered']);

/**
 * Return the status list for the current graph.
 * Array of {id, label, color} in display order.
 */
function getStatusList() {
  if (graphData && Array.isArray(graphData.statuses) && graphData.statuses.length > 0) {
    return graphData.statuses;
  }
  return DEFAULT_STATUSES;
}

/** True if the current graph uses the default status scheme. */
function usesDefaultScheme() {
  return !graphData || !Array.isArray(graphData.statuses) || graphData.statuses.length === 0;
}

/** Return {bg, fg} colours for a status id. */
function getStatusColour(statusId) {
  const list = getStatusList();
  const entry = list.find(s => s.id === statusId);
  if (!entry) return { bg: '#3a3a4a', fg: '#9999aa' };
  return { bg: entry.color, fg: contrastColour(entry.color) };
}

/** Return black or white for best contrast on a hex background. */
function contrastColour(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? '#1a1a2e' : '#ffffff';
}

/** Return the default status id (first in the list). */
function getDefaultStatus() {
  return getStatusList()[0]?.id || 'untested';
}

// --- Colour mode ---

var colourMode = 'status'; // 'status' or a dimension ID

/** Return the list of dimensions defined in the current graph. */
function getDimensions() {
  if (graphData && Array.isArray(graphData.dimensions)) return graphData.dimensions;
  return [];
}

/** Set the colour mode and refresh the view. */
function setColourMode(mode) {
  colourMode = mode;
  refreshGraph();
  buildLegend();
}

/** Return {bg, fg} for a node based on the current colour mode. */
function getNodeColour(nodeId) {
  const node = graphData && graphData.nodes[nodeId];
  if (!node) return { bg: '#3a3a4a', fg: '#9999aa' };

  if (colourMode === 'status') {
    return getStatusColour(node.status || getDefaultStatus());
  }

  // Dimension mode
  const dimValue = (node.dimensions || {})[colourMode];
  if (!dimValue) return { bg: '#2a2a3a', fg: '#666680' }; // neutral grey for unassigned

  const dim = getDimensions().find(d => d.id === colourMode);
  if (!dim) return { bg: '#2a2a3a', fg: '#666680' };

  const val = dim.values.find(v => v.id === dimValue);
  if (!val) return { bg: '#2a2a3a', fg: '#666680' };

  return { bg: val.color, fg: contrastColour(val.color) };
}

function computeFrontier(nodes) {
  // Frontier only meaningful with default scheme
  if (!usesDefaultScheme()) return new Set();
  const frontier = new Set();
  for (const [id, node] of Object.entries(nodes)) {
    const status = node.status || 'untested';
    if (DEFAULT_PASSED.has(status)) continue;
    const prereqs = node.prerequisites || [];
    const allPassed = prereqs.every(
      p => DEFAULT_PASSED.has((nodes[p] || {}).status || 'untested')
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
  const statuses = getStatusList();
  const counts = {};
  for (const s of statuses) counts[s.id] = 0;
  for (const node of Object.values(graphData.nodes)) {
    const s = node.status || getDefaultStatus();
    counts[s] = (counts[s] || 0) + 1;
  }
  counts.total = Object.keys(graphData.nodes).length;
  counts.frontier = computeFrontier(graphData.nodes).size;
  return counts;
}

/**
 * Save current graph state to the server.
 * Includes node positions if cytoscape is active.
 * Only works when loaded via ?graph= and running server.js.
 */
function autoSave() {
  if (!graphData || !graphFilePath) return;

  // Capture positions if cy is active
  if (typeof cy !== 'undefined' && cy) {
    cy.nodes().forEach(n => {
      const pos = n.position();
      if (graphData.nodes[n.id()]) {
        graphData.nodes[n.id()].position = { x: Math.round(pos.x), y: Math.round(pos.y) };
      }
    });
  }

  const json = JSON.stringify(graphData, null, 2);
  const saveUrl = graphFilePath === 'ext-graph'
    ? '/ext-graph'
    : `/save?file=${encodeURIComponent(graphFilePath)}`;
  fetch(saveUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  }).catch(() => {
    // Silent fail — server might be npx serve without save endpoint
  });
}
