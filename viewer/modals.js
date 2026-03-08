/**
 * Modal dialogs — add node, edit status.
 */

// --- Add Node ---

let addNodePosition = null; // {x, y} if opened via double-click
let autoIdEnabled = true;   // false once user manually edits the ID

function toKebabCase(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function autoGenerateId(nameValue) {
  if (!autoIdEnabled) return;
  document.getElementById('new-node-id').value = toKebabCase(nameValue);
}

function showAddNodeModal(position) {
  addNodePosition = position || null;
  autoIdEnabled = true;
  document.getElementById('add-node-modal').classList.add('visible');
  setTimeout(() => document.getElementById('new-node-name').focus(), 50);

  // Detect manual ID edits to stop auto-generation
  const idField = document.getElementById('new-node-id');
  idField.oninput = () => { autoIdEnabled = false; };
}

function hideAddNodeModal() {
  document.getElementById('add-node-modal').classList.remove('visible');
  document.getElementById('new-node-id').value = '';
  document.getElementById('new-node-name').value = '';
  document.getElementById('new-node-desc').value = '';
  document.getElementById('new-node-prereqs').value = '';
  addNodePosition = null;
  autoIdEnabled = true;
}

function addNode() {
  const id = document.getElementById('new-node-id').value.trim();
  const name = document.getElementById('new-node-name').value.trim();
  const desc = document.getElementById('new-node-desc').value.trim();
  const prereqStr = document.getElementById('new-node-prereqs').value.trim();
  const prereqs = prereqStr
    ? prereqStr.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (!id) { alert('ID is required'); return; }
  if (graphData.nodes[id]) { alert(`Node "${id}" already exists`); return; }

  for (const p of prereqs) {
    if (!graphData.nodes[p]) {
      alert(`Prerequisite "${p}" does not exist`);
      return;
    }
  }

  const nodeData = {
    name: name || id,
    description: desc,
    prerequisites: prereqs,
    status: getDefaultStatus(),
    last_tested: null,
    exercise_series: null,
  };

  if (addNodePosition) {
    nodeData.position = { x: Math.round(addNodePosition.x), y: Math.round(addNodePosition.y) };
  }

  graphData.nodes[id] = nodeData;

  hideAddNodeModal();
  initGraph();
  autoSave();
}

// --- Delete Node ---

function deleteNode(nodeId) {
  const deps = getDependents(nodeId);
  if (deps.length > 0) {
    const names = deps.map(d => (graphData.nodes[d] || {}).name || d).join(', ');
    alert(`Cannot delete: depended on by ${names}`);
    return;
  }
  const name = (graphData.nodes[nodeId] || {}).name || nodeId;
  if (!confirm(`Delete "${name}"?`)) return;

  delete graphData.nodes[nodeId];
  clearPanel();
  initGraph();
  autoSave();
}

// --- Edit Status ---

let editingStatusNode = null;
let editingStatusValue = null;

function showEditStatusModal(nodeId) {
  const node = graphData.nodes[nodeId];
  if (!node) return;

  editingStatusNode = nodeId;
  editingStatusValue = node.status || getDefaultStatus();

  document.getElementById('status-node-name').textContent = node.name || nodeId;
  renderStatusOptions();
  document.getElementById('edit-status-modal').classList.add('visible');
}

function hideEditStatusModal() {
  document.getElementById('edit-status-modal').classList.remove('visible');
  editingStatusNode = null;
}

function renderStatusOptions() {
  const container = document.getElementById('status-options');
  const statuses = getStatusList();
  container.innerHTML = statuses.map(s => {
    const selected = s.id === editingStatusValue ? 'selected' : '';
    return `
      <div class="status-option ${selected}" onclick="pickStatus('${s.id}')">
        <div class="status-dot" style="background:${s.color}"></div>
        <span class="status-label">${esc(s.label)}</span>
      </div>
    `;
  }).join('');
}

function pickStatus(status) {
  if (!editingStatusNode || !graphData.nodes[editingStatusNode]) return;

  graphData.nodes[editingStatusNode].status = status;
  hideEditStatusModal();
  refreshGraph();
  if (selectedNode === editingStatusNode) showPanel(editingStatusNode);
  autoSave();
}

// --- Import / Export ---

function importGraph() {
  const input = document.getElementById('file-input');
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        graphData = JSON.parse(ev.target.result);
        colourMode = 'status';
        buildColourModeDropdown();
        buildLegend();
        initGraph();
        clearPanel();
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    input.value = '';
  };
  input.click();
}

function exportGraph() {
  if (!graphData || !cy) return;
  // Save current node positions into graphData
  cy.nodes().forEach(n => {
    const pos = n.position();
    if (graphData.nodes[n.id()]) {
      graphData.nodes[n.id()].position = { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  });
  const json = JSON.stringify(graphData, null, 2);
  const blob = new Blob([json + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (graphData.name || 'graph').toLowerCase().replace(/\s+/g, '-') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('visible');
  }
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.visible').forEach(
      m => m.classList.remove('visible')
    );
  }
});
