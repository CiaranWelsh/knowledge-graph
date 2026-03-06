/**
 * Side panel — node detail view.
 */

let selectedNode = null;

const NODE_SHAPES = [
  'round-rectangle', 'ellipse', 'diamond', 'triangle', 'round-triangle',
  'rectangle', 'cut-rectangle', 'barrel', 'rhomboid', 'round-diamond',
  'pentagon', 'round-pentagon', 'hexagon', 'round-hexagon', 'concave-hexagon',
  'heptagon', 'octagon', 'star', 'tag', 'round-tag', 'vee',
];

function showPanel(nodeId) {
  const panel = document.getElementById('panel');
  const content = document.getElementById('panel-content');
  const node = graphData.nodes[nodeId];
  if (!node) return;

  panel.classList.remove('collapsed');

  const status = node.status || getDefaultStatus();
  const colours = getStatusColour(status);
  const prereqs = node.prerequisites || [];
  const deps = getDependents(nodeId);

  content.innerHTML = `
    <div class="panel-header">
      <input class="panel-name-input" value="${esc(node.name || nodeId)}"
             onblur="changeName('${escId(nodeId)}', this.value)"
             onkeydown="if(event.key==='Enter'){this.blur()}">
      <span class="node-id">${esc(nodeId)}</span>
    </div>

    <div class="panel-section">
      <span class="panel-label">Status</span>
      <div>
        <span class="status-badge"
              style="background:${colours.bg};color:${colours.fg}"
              onclick="showEditStatusModal('${escId(nodeId)}')">
          ${esc(status)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </span>
      </div>
    </div>

    <div class="panel-section">
      <span class="panel-label">Shape</span>
      <div>
        <select class="shape-select" onchange="changeShape('${escId(nodeId)}', this.value)">
          ${NODE_SHAPES.map(s =>
            `<option value="${s}" ${s === (node.shape || 'round-rectangle') ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="panel-section">
      <span class="panel-label">Description</span>
      <textarea class="panel-textarea" id="desc-editor"
                placeholder="Add a description..."
                onblur="changeDescription('${escId(nodeId)}', this.value)">${esc(node.description || '')}</textarea>
    </div>

    <div class="panel-section">
      <span class="panel-label">Prerequisites</span>
      <div class="tag-list">
        ${prereqs.length === 0
          ? '<span class="tag-empty">Root node</span>'
          : prereqs.map(p => {
              const pn = (graphData.nodes[p] || {});
              const ps = pn.status || getDefaultStatus();
              const pc = getStatusColour(ps);
              return `<span class="tag" onclick="selectNode('${escId(p)}')">
                <span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:${pc.bg};margin-right:4px"></span>
                ${esc(pn.name || p)}
              </span>`;
            }).join('')}
      </div>
    </div>

    <div class="panel-section">
      <span class="panel-label">Dependents</span>
      <div class="tag-list">
        ${deps.length === 0
          ? '<span class="tag-empty">None</span>'
          : deps.map(d => {
              const dn = (graphData.nodes[d] || {});
              const ds = dn.status || getDefaultStatus();
              const dc = getStatusColour(ds);
              return `<span class="tag" onclick="selectNode('${escId(d)}')">
                <span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:${dc.bg};margin-right:4px"></span>
                ${esc(dn.name || d)}
              </span>`;
            }).join('')}
      </div>
    </div>

    ${node.exercise_series ? `
    <div class="panel-section">
      <span class="panel-label">Exercise Series</span>
      <div class="panel-value mono">${esc(node.exercise_series)}</div>
    </div>` : ''}

    <div class="panel-footer">
      <button class="danger" onclick="deleteNode('${escId(nodeId)}')" style="width:100%">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
        Delete Node
      </button>
    </div>
  `;
}

function clearPanel() {
  const panel = document.getElementById('panel');
  panel.classList.add('collapsed');
  document.getElementById('panel-content').innerHTML = '';
}

function selectNode(nodeId) {
  if (!cy) return;
  const node = cy.getElementById(nodeId);
  if (node.length) {
    cy.elements().unselect();
    node.select();
    selectedNode = nodeId;
    showPanel(nodeId);
    cy.animate({ center: { eles: node }, duration: 200 });
  }
}

function changeName(nodeId, value) {
  if (!graphData || !graphData.nodes[nodeId]) return;
  const trimmed = value.trim();
  if (!trimmed || graphData.nodes[nodeId].name === trimmed) return;
  graphData.nodes[nodeId].name = trimmed;
  refreshGraph();
  autoSave();
}

function changeDescription(nodeId, value) {
  if (!graphData || !graphData.nodes[nodeId]) return;
  const trimmed = value.trim();
  if (graphData.nodes[nodeId].description === trimmed) return;
  graphData.nodes[nodeId].description = trimmed;
  autoSave();
}

function changeShape(nodeId, shape) {
  if (!graphData || !graphData.nodes[nodeId]) return;
  graphData.nodes[nodeId].shape = shape;
  refreshGraph();
  autoSave();
}

// --- Utils ---
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escId(s) {
  return s.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}
