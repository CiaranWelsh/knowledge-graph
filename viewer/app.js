/**
 * App initialisation — load graph and build legend.
 *
 * Usage: viewer/?graph=path/to/graph.json
 * Path is relative to the server root.
 * If no ?graph param, shows empty canvas with import prompt.
 */

document.addEventListener('DOMContentLoaded', async () => {
  buildLegend(); // build with defaults initially

  const params = new URLSearchParams(window.location.search);
  const graphPath = params.get('graph');

  if (graphPath) {
    graphFilePath = graphPath;
    try {
      // Resolve relative to repo root, not viewer/
      const url = graphPath.startsWith('/') ? graphPath : '../' + graphPath.replace(/^\.\.\//, '');
      const resp = await fetch(url);
      if (resp.ok) {
        graphData = await resp.json();
        colourMode = 'status'; // reset on new graph load
        buildColourModeDropdown();
        buildLegend();
        initGraph();
      } else {
        console.error(`Failed to load ${graphPath}: ${resp.status}`);
      }
    } catch (e) {
      console.error(`Failed to load ${graphPath}:`, e);
    }
  }
});

function buildColourModeDropdown() {
  const select = document.getElementById('colour-mode-select');
  if (!select) return;
  const dims = getDimensions();
  select.innerHTML = '<option value="status">Status</option>' +
    dims.map(d => `<option value="${d.id}">${d.label}</option>`).join('');
  select.value = colourMode;
  // Hide the dropdown + label if no dimensions defined
  select.style.display = dims.length > 0 ? '' : 'none';
  const label = select.previousElementSibling;
  if (label && label.classList.contains('toolbar-label')) {
    label.style.display = dims.length > 0 ? '' : 'none';
  }
  // Also hide the divider before "Colour" when no dimensions
  const divider = label && label.previousElementSibling;
  if (divider && divider.classList.contains('toolbar-divider')) {
    divider.style.display = dims.length > 0 ? '' : 'none';
  }
}

function buildLegend() {
  let items;
  if (colourMode === 'status') {
    const statuses = getStatusList();
    items = statuses.map(s => ({ key: s.id, bg: s.color, label: s.label }));
  } else {
    const dim = getDimensions().find(d => d.id === colourMode);
    if (dim) {
      items = dim.values.map(v => ({ key: v.id, bg: v.color, label: v.label }));
      items.push({ key: '__none', bg: '#2a2a3a', label: 'Unassigned' });
    } else {
      items = [];
    }
  }

  // Footer legend (compact)
  const footer = document.getElementById('legend-items');
  footer.innerHTML = items.map(item => `
    <div class="legend-item"
         data-status="${item.key}"
         onclick="toggleHighlight('${item.key}')">
      <div class="legend-dot" style="background:${item.bg}"></div>
      <span>${item.label}</span>
    </div>
  `).join('');

  // Canvas legend (detailed)
  const canvas = document.getElementById('canvas-legend-items');
  if (canvas) {
    canvas.innerHTML = items.map(item => `
      <div class="canvas-legend-item"
           data-status="${item.key}"
           onclick="toggleHighlight('${item.key}')">
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
