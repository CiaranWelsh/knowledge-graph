/**
 * Cytoscape graph rendering and layout.
 */

var cy = null;
var currentLayout = 'dagre';
var highlightStatus = null;

function initGraph() {
  const elements = buildElements(graphData);

  if (cy) cy.destroy();

  cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'background-color': 'data(bg)',
          'color': 'data(fg)',
          'font-size': '11px',
          'font-weight': 500,
          'font-family': 'IBM Plex Sans, -apple-system, sans-serif',
          'shape': 'data(shape)',
          'width': 'label',
          'height': 'label',
          'padding': '12px',
          'border-width': 'data(borderWidth)',
          'border-color': 'data(borderColor)',
          'border-opacity': 'data(borderOpacity)',
          'text-wrap': 'wrap',
          'text-max-width': '130px',
          'overlay-padding': 4,
          'transition-property': 'background-color, border-color, border-width, opacity',
          'transition-duration': '150ms',
        }
      },
      {
        selector: 'node.dimmed',
        style: { 'opacity': 0.12 }
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': 'rgba(255,255,255,0.08)',
          'target-arrow-color': 'rgba(255,255,255,0.15)',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 0.7,
          'transition-property': 'opacity, line-color',
          'transition-duration': '150ms',
        }
      },
      {
        selector: 'edge.dimmed',
        style: { 'opacity': 0.04 }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 2,
          'border-color': '#7c5cfc',
          'border-opacity': 1,
        }
      },
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#7c5cfc',
          'target-arrow-color': '#7c5cfc',
          'width': 2,
        }
      },
      {
        selector: '.eh-handle',
        style: {
          'background-color': '#7c5cfc',
          'width': 10,
          'height': 10,
          'shape': 'ellipse',
          'overlay-opacity': 0,
          'border-width': 8,
          'border-opacity': 0,
        }
      },
      {
        selector: '.eh-hover',
        style: {
          'background-color': '#9678ff',
        }
      },
      {
        selector: '.eh-ghost-edge.eh-preview-active',
        style: {
          'line-color': '#7c5cfc',
          'target-arrow-color': '#7c5cfc',
          'target-arrow-shape': 'triangle',
          'opacity': 0.6,
        }
      },
      {
        selector: '.eh-source',
        style: {
          'border-width': 2,
          'border-color': '#7c5cfc',
        }
      },
      {
        selector: '.eh-target',
        style: {
          'border-width': 2,
          'border-color': '#9678ff',
        }
      },
      {
        selector: '.eh-preview',
        style: {
          'background-color': '#7c5cfc',
          'line-color': '#7c5cfc',
          'target-arrow-color': '#7c5cfc',
          'source-arrow-color': '#7c5cfc',
        }
      },
    ],
    layout: { name: 'preset' },
    wheelSensitivity: 0.25,
    minZoom: 0.05,
    maxZoom: 10,
  });

  // Wire events
  cy.on('tap', 'node', (e) => {
    selectedNode = e.target.id();
    showPanel(selectedNode);
  });

  cy.on('tap', (e) => {
    if (e.target === cy) {
      selectedNode = null;
      clearPanel();
    }
  });

  cy.on('cxttap', 'node', (e) => {
    deleteNode(e.target.id());
  });

  // Double-click on empty canvas → add node at that position
  cy.on('dbltap', (e) => {
    if (e.target === cy) {
      const pos = e.position; // model coordinates
      showAddNodeModal({ x: pos.x, y: pos.y });
    }
  });

  // Edge drawing with edgehandles (Shift+drag)
  initEdgeHandles();

  // Update title
  const titleEl = document.getElementById('graph-title');
  titleEl.value = graphData.name || 'Skill Tree';

  // Hide canvas hint if there are nodes
  const hint = document.getElementById('canvas-hint');
  if (hint) {
    hint.classList.toggle('hidden', Object.keys(graphData.nodes).length > 0);
  }

  // If nodes have saved positions, use them; otherwise run layout
  const hasPositions = Object.values(graphData.nodes).some(n => n.position);
  if (hasPositions) {
    updateLegend();
  } else {
    runLayout(currentLayout);
    updateLegend();
  }
}

function buildElements(data) {
  const nodes = data.nodes || {};
  const frontierIds = computeFrontier(nodes);
  const elements = [];

  for (const [id, node] of Object.entries(nodes)) {
    const colours = getNodeColour(id);
    const isFrontier = frontierIds.has(id);

    const el = {
      group: 'nodes',
      data: {
        id,
        label: node.name || id,
        bg: colours.bg,
        fg: colours.fg,
        status: node.status || getDefaultStatus(),
        shape: node.shape || 'round-rectangle',
        borderWidth: isFrontier ? 2.5 : 0,
        borderColor: isFrontier ? '#ffffff' : colours.bg,
        borderOpacity: isFrontier ? 0.8 : 0,
      }
    };
    if (node.position) {
      el.position = { x: node.position.x, y: node.position.y };
    }
    elements.push(el);

    for (const prereq of (node.prerequisites || [])) {
      if (nodes[prereq]) {
        elements.push({
          group: 'edges',
          data: { id: `${prereq}->${id}`, source: prereq, target: id }
        });
      }
    }
  }

  return elements;
}

function runLayout(name) {
  if (!cy) return;
  currentLayout = name;

  document.querySelectorAll('.button-group button').forEach(
    b => b.classList.remove('active')
  );
  const btn = document.getElementById(`btn-${name}`);
  if (btn) btn.classList.add('active');

  const opts = {
    dagre: {
      name: 'dagre',
      rankDir: 'BT',
      nodeSep: 50,
      rankSep: 70,
      animate: true,
      animationDuration: 350,
      animationEasing: 'ease-in-out-cubic',
    },
    cose: {
      name: 'cose',
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      nodeRepulsion: 10000,
      idealEdgeLength: 120,
      gravity: 0.2,
      numIter: 200,
    },
    concentric: {
      name: 'concentric',
      animate: true,
      animationDuration: 350,
      animationEasing: 'ease-in-out-cubic',
      concentric: (node) => -getDepth(node.id()),
      levelWidth: () => 2,
      minNodeSpacing: 60,
    },
  };

  cy.layout(opts[name] || opts.dagre).run();
}

function toggleHighlight(key) {
  if (!cy) return;

  if (highlightStatus === key) {
    highlightStatus = null;
    cy.elements().removeClass('dimmed');
    document.querySelectorAll('.legend-item').forEach(
      el => el.classList.remove('dimmed')
    );
    return;
  }

  highlightStatus = key;

  document.querySelectorAll('.legend-item').forEach(el => {
    el.classList.toggle('dimmed', el.dataset.status !== key);
  });

  if (key === 'frontier') {
    const frontier = computeFrontier(graphData.nodes);
    cy.nodes().forEach(n => n.toggleClass('dimmed', !frontier.has(n.id())));
    cy.edges().addClass('dimmed');
  } else if (colourMode === 'status') {
    cy.nodes().forEach(n => n.toggleClass('dimmed', n.data('status') !== key));
    cy.edges().addClass('dimmed');
  } else {
    // Dimension mode — filter by dimension value
    cy.nodes().forEach(n => {
      const node = graphData.nodes[n.id()];
      const val = (node && node.dimensions || {})[colourMode] || '';
      const match = key === '__none' ? !val : val === key;
      n.toggleClass('dimmed', !match);
    });
    cy.edges().addClass('dimmed');
  }
}

function refreshGraph() {
  if (!cy || !graphData) return;
  const frontierIds = computeFrontier(graphData.nodes);

  cy.nodes().forEach(n => {
    const node = graphData.nodes[n.id()];
    if (!node) return;
    const colours = getNodeColour(n.id());
    const isFrontier = frontierIds.has(n.id());

    n.data('label', node.name || n.id());
    n.data('bg', colours.bg);
    n.data('fg', colours.fg);
    n.data('status', node.status || getDefaultStatus());
    n.data('shape', node.shape || 'round-rectangle');
    n.data('borderWidth', isFrontier ? 2.5 : 0);
    n.data('borderColor', isFrontier ? '#ffffff' : colours.bg);
    n.data('borderOpacity', isFrontier ? 0.8 : 0);
  });

  updateLegend();
}

var eh = null;
var shiftHeld = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift' && !shiftHeld) {
    shiftHeld = true;
    if (eh) eh.enableDrawMode();
    const badge = document.getElementById('edge-mode-badge');
    if (badge) badge.classList.add('visible');
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftHeld = false;
    if (eh) eh.disableDrawMode();
    const badge = document.getElementById('edge-mode-badge');
    if (badge) badge.classList.remove('visible');
  }
});

function initEdgeHandles() {
  if (!cy || typeof cy.edgehandles !== 'function') return;
  if (eh) eh.destroy();

  eh = cy.edgehandles({
    canConnect: (sourceNode, targetNode) => {
      // No self-loops, no duplicate edges
      if (sourceNode.id() === targetNode.id()) return false;
      const targetData = graphData.nodes[targetNode.id()];
      if (!targetData) return false;
      return !(targetData.prerequisites || []).includes(sourceNode.id());
    },
    edgeParams: (sourceNode, targetNode) => ({
      data: {
        id: `${sourceNode.id()}->${targetNode.id()}`,
        source: sourceNode.id(),
        target: targetNode.id(),
      }
    }),
    snap: true,
    noEdgeEventsInDraw: true,
    disableBrowserGestures: true,
  });

  // When an edge is created via edgehandles, update the data model
  cy.on('ehcomplete', (event, sourceNode, targetNode, addedEdge) => {
    const sourceId = sourceNode.id();
    const targetId = targetNode.id();
    const targetData = graphData.nodes[targetId];
    if (targetData) {
      if (!targetData.prerequisites) targetData.prerequisites = [];
      if (!targetData.prerequisites.includes(sourceId)) {
        targetData.prerequisites.push(sourceId);
      }
    }
    refreshGraph();
    autoSave();
  });

  // Enable draw mode if shift is currently held
  if (shiftHeld) eh.enableDrawMode();
}

var nodeFontSize = 11;

function changeFontSize(delta) {
  nodeFontSize = Math.max(4, Math.min(72, nodeFontSize + delta));
  if (!cy) return;
  cy.style().selector('node').style('font-size', nodeFontSize + 'px').update();
}
