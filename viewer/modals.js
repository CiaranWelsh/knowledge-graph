/**
 * Modal dialogs — add node, edit status.
 */

// --- Add Node ---

function showAddNodeModal() {
  document.getElementById('add-node-modal').classList.add('visible');
  setTimeout(() => document.getElementById('new-node-id').focus(), 50);
}

function hideAddNodeModal() {
  document.getElementById('add-node-modal').classList.remove('visible');
  document.getElementById('new-node-id').value = '';
  document.getElementById('new-node-name').value = '';
  document.getElementById('new-node-desc').value = '';
  document.getElementById('new-node-prereqs').value = '';
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

  graphData.nodes[id] = {
    name: name || id,
    description: desc,
    prerequisites: prereqs,
    status: 'untested',
    last_tested: null,
    exercise_series: null,
  };

  hideAddNodeModal();
  initGraph();
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
}

// --- Edit Status ---

let editingStatusNode = null;
let editingStatusValue = null;

function showEditStatusModal(nodeId) {
  const node = graphData.nodes[nodeId];
  if (!node) return;

  editingStatusNode = nodeId;
  editingStatusValue = node.status || 'untested';

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
  container.innerHTML = STATUSES.map(s => {
    const c = STATUS_COLOURS[s];
    const selected = s === editingStatusValue ? 'selected' : '';
    return `
      <div class="status-option ${selected}" onclick="pickStatus('${s}')">
        <div class="status-dot" style="background:${c.bg}"></div>
        <span class="status-label">${s.charAt(0).toUpperCase() + s.slice(1)}</span>
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
