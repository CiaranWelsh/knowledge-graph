/**
 * App initialisation — load graph and build legend.
 */

document.addEventListener('DOMContentLoaded', async () => {
  buildLegend();

  try {
    const resp = await fetch('../examples/algorithms.json');
    if (resp.ok) {
      graphData = await resp.json();
      initGraph();
    }
  } catch (e) {
    console.log('No default graph found. Use Import to load one.');
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
