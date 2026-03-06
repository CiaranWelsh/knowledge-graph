/**
 * App initialisation — load graph and build legend.
 *
 * Usage: viewer/?graph=path/to/graph.json
 * Path is relative to the server root.
 * If no ?graph param, shows empty canvas with import prompt.
 */

document.addEventListener('DOMContentLoaded', async () => {
  buildLegend();

  const params = new URLSearchParams(window.location.search);
  const graphPath = params.get('graph');

  if (graphPath) {
    try {
      const resp = await fetch(graphPath);
      if (resp.ok) {
        graphData = await resp.json();
        initGraph();
      } else {
        console.error(`Failed to load ${graphPath}: ${resp.status}`);
      }
    } catch (e) {
      console.error(`Failed to load ${graphPath}:`, e);
    }
  }
});

function buildLegend() {
  // Footer legend (compact)
  const footer = document.getElementById('legend-items');
  const items = STATUSES.map(s => ({
    status: s,
    bg: STATUS_COLOURS[s].bg,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  }));

  footer.innerHTML = items.map(item => `
    <div class="legend-item"
         data-status="${item.status}"
         onclick="toggleHighlight('${item.status}')">
      <div class="legend-dot" style="background:${item.bg}"></div>
      <span>${item.label}</span>
    </div>
  `).join('');

  // Canvas legend (detailed)
  const canvas = document.getElementById('canvas-legend-items');
  if (canvas) {
    canvas.innerHTML = items.map(item => `
      <div class="canvas-legend-item"
           data-status="${item.status}"
           onclick="toggleHighlight('${item.status}')">
        <div class="canvas-legend-dot" style="background:${item.bg}"></div>
        <span>${item.label}</span>
      </div>
    `).join('');
  }
}

function updateLegend() {
  const stats = getStats();
  const el = document.getElementById('legend-stats');
  el.textContent = `${stats.total} nodes · ${stats.frontier} frontier`;
}
