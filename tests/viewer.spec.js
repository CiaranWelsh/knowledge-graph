const { test, expect } = require('@playwright/test');
const { SAMPLE_GRAPH, writeFixtureGraph, readFixtureGraph, cleanupFixtures } = require('./fixtures');

test.afterAll(() => {
  cleanupFixtures();
});

/** Wait for cytoscape to be ready with the expected number of nodes */
async function waitForGraph(page, nodeCount) {
  await page.waitForFunction(
    (count) => window.cy && typeof window.cy.nodes === 'function' && window.cy.nodes().length === count,
    nodeCount
  );
}

/** Wait for cytoscape instance to exist (empty graph OK) */
async function waitForCy(page) {
  await page.waitForFunction(() => window.cy && typeof window.cy.nodes === 'function');
}

/** Create a new graph through the modal (for tests that don't load a fixture) */
async function createGraphViaModal(page, name) {
  await page.fill('#new-graph-name', name || 'Test');
  await page.click('#new-graph-modal button.primary');
  await waitForCy(page);
}

// ---------------------------------------------------------------------------
// 1. New Graph Flow
// ---------------------------------------------------------------------------

test.describe('New graph creation', () => {
  test('shows new-graph modal when no ?graph= param', async ({ page }) => {
    await page.goto('/viewer/');
    const modal = page.locator('#new-graph-modal');
    await expect(modal).toBeVisible();
  });

  test('creates empty graph from modal', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page, 'My Test Graph');

    // Modal should close
    await expect(page.locator('#new-graph-modal')).not.toBeVisible();

    // Title should update
    await expect(page.locator('#graph-title')).toHaveValue('My Test Graph');

    // Canvas hint should be visible (no nodes yet)
    await expect(page.locator('#canvas-hint')).toBeVisible();
  });

  test('creates graph with file path and updates URL', async ({ page }) => {
    await page.goto('/viewer/');
    await page.fill('#new-graph-name', 'Saved Graph');
    await page.fill('#new-graph-path', 'tests/fixture-graphs/new-graph.json');
    await page.click('#new-graph-modal button.primary');

    // URL should contain the graph param
    await expect(page).toHaveURL(/graph=tests.*new-graph\.json/);
  });

  test('shows modal with prefilled path when ?graph= file 404s', async ({ page }) => {
    await page.goto('/viewer/?graph=tests/fixture-graphs/nonexistent-file.json');
    const modal = page.locator('#new-graph-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#new-graph-path')).toHaveValue(
      'tests/fixture-graphs/nonexistent-file.json'
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Loading an existing graph
// ---------------------------------------------------------------------------

test.describe('Loading existing graph', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('load-test.json', SAMPLE_GRAPH);
  });

  test('loads graph and displays nodes', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    const name = await page.evaluate(() => window.graphData.name);
    expect(name).toBe('Test Graph');
  });

  test('new-graph modal does NOT appear for valid graph', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);
    await expect(page.locator('#new-graph-modal')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Add Node (toolbar)
// ---------------------------------------------------------------------------

test.describe('Add node via toolbar', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('add-node-test.json', {
      name: 'Add Node Test',
      nodes: {},
    });
  });

  test('opens add-node modal from toolbar button', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForCy(page);
    await page.click('button:has-text("Add Node")');
    await expect(page.locator('#add-node-modal')).toBeVisible();
  });

  test('adds a node with name and auto-generated ID', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForCy(page);
    await page.click('button:has-text("Add Node")');

    await page.fill('#new-node-name', 'Binary Search');
    // ID should be auto-generated
    await expect(page.locator('#new-node-id')).toHaveValue('binary-search');

    await page.click('#add-node-modal button.primary');

    // Modal should close and node should exist
    await expect(page.locator('#add-node-modal')).not.toBeVisible();
    await waitForGraph(page, 1);
  });

  test('prevents adding node with duplicate ID', async ({ page }) => {
    // Pre-populate a node
    const data = { name: 'Dup Test', nodes: { 'existing': { name: 'Existing', prerequisites: [], status: 'untested' } } };
    const gp = writeFixtureGraph('dup-test.json', data);
    await page.goto(`/viewer/?graph=${gp}`);
    await waitForGraph(page, 1);

    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', 'Existing');
    await page.fill('#new-node-id', 'existing');

    // Listen for alert dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('already exists');
      await dialog.accept();
    });

    await page.click('#add-node-modal button.primary');
  });

  test('prevents adding node with nonexistent prerequisite', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForCy(page);
    await page.click('button:has-text("Add Node")');

    await page.fill('#new-node-name', 'Test Node');
    await page.fill('#new-node-prereqs', 'does-not-exist');

    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('does not exist');
      await dialog.accept();
    });

    await page.click('#add-node-modal button.primary');
  });
});

// ---------------------------------------------------------------------------
// 4. Auto-ID generation
// ---------------------------------------------------------------------------

test.describe('Auto-ID generation', () => {
  test('converts name to kebab-case ID', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', 'Hello World Test');
    await expect(page.locator('#new-node-id')).toHaveValue('hello-world-test');
  });

  test('strips special characters from auto-ID', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', "It's a Test! (v2)");
    await expect(page.locator('#new-node-id')).toHaveValue('its-a-test-v2');
  });

  test('stops auto-generating once user edits ID manually', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', 'First');
    await expect(page.locator('#new-node-id')).toHaveValue('first');

    // Manually edit the ID
    await page.fill('#new-node-id', 'custom-id');

    // Now change the name — ID should stay as manually set
    await page.fill('#new-node-name', 'Second Name');
    await expect(page.locator('#new-node-id')).toHaveValue('custom-id');
  });
});

// ---------------------------------------------------------------------------
// 5. Double-click canvas to add node
// ---------------------------------------------------------------------------

test.describe('Double-click canvas to add node', () => {
  test('opens add-node modal on canvas double-click', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page, 'DblClick Test');

    // Double-click the center of the canvas
    const cy = page.locator('#cy');
    await cy.dblclick({ position: { x: 400, y: 300 } });
    await expect(page.locator('#add-node-modal')).toBeVisible();
  });

  test('node placed at click position', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page, 'Position Test');

    const cy = page.locator('#cy');
    await cy.dblclick({ position: { x: 400, y: 300 } });

    await page.fill('#new-node-name', 'Positioned Node');
    await page.click('#add-node-modal button.primary');

    // Node should exist and have a position saved
    const hasPosition = await page.evaluate(() => {
      const node = window.graphData.nodes['positioned-node'];
      return node && node.position && typeof node.position.x === 'number';
    });
    expect(hasPosition).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Edge drawing (Shift+drag)
// ---------------------------------------------------------------------------

test.describe('Edge drawing', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('edge-draw-test.json', {
      name: 'Edge Draw Test',
      nodes: {
        'source': { name: 'Source', prerequisites: [], status: 'untested', position: { x: 200, y: 300 } },
        'target': { name: 'Target', prerequisites: [], status: 'untested', position: { x: 500, y: 300 } },
      },
    });
  });

  test('edge mode badge appears on Shift press', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 2);

    await expect(page.locator('#edge-mode-badge')).not.toHaveClass(/visible/);
    await page.keyboard.down('Shift');
    await expect(page.locator('#edge-mode-badge')).toHaveClass(/visible/);
    await page.keyboard.up('Shift');
    await expect(page.locator('#edge-mode-badge')).not.toHaveClass(/visible/);
  });

  test('Shift+drag creates prerequisite edge', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 2);

    // Check edgehandles is available
    const hasEdgeHandles = await page.evaluate(() => typeof window.cy.edgehandles === 'function');
    if (!hasEdgeHandles) {
      test.skip();
      return;
    }

    // Get rendered node positions in screen coords
    const positions = await page.evaluate(() => {
      const sourceNode = window.cy.getElementById('source');
      const targetNode = window.cy.getElementById('target');
      const sourcePos = sourceNode.renderedPosition();
      const targetPos = targetNode.renderedPosition();
      const cyRect = document.getElementById('cy').getBoundingClientRect();
      return {
        source: { x: cyRect.left + sourcePos.x, y: cyRect.top + sourcePos.y },
        target: { x: cyRect.left + targetPos.x, y: cyRect.top + targetPos.y },
      };
    });

    // Shift+drag from source to target
    await page.keyboard.down('Shift');
    await page.waitForTimeout(100);
    await page.mouse.move(positions.source.x, positions.source.y);
    await page.mouse.down();
    // Slow drag with many steps to trigger edgehandles
    await page.mouse.move(positions.target.x, positions.target.y, { steps: 20 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.keyboard.up('Shift');

    // Check that target now has source as a prerequisite
    const prereqs = await page.evaluate(() => {
      return window.graphData.nodes['target'].prerequisites;
    });
    expect(prereqs).toContain('source');
  });
});

// ---------------------------------------------------------------------------
// 7. Remove prerequisite
// ---------------------------------------------------------------------------

test.describe('Remove prerequisite', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('remove-prereq-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('clicking × removes prerequisite and edge', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Click node-b to select it (it has node-a as prerequisite)
    await page.evaluate(() => {
      window.cy.getElementById('node-b').emit('tap');
    });

    // Panel should show and have a remove button
    const panel = page.locator('#panel');
    await expect(panel).not.toHaveClass(/collapsed/);

    // Hover the tag to reveal the × button, then click it
    const tag = page.locator('.tag').first();
    await tag.hover();
    const removeBtn = page.locator('.tag-remove').first();
    await removeBtn.click();

    // Prerequisite should be removed from data
    const prereqs = await page.evaluate(() => {
      return window.graphData.nodes['node-b'].prerequisites;
    });
    expect(prereqs).not.toContain('node-a');

    // Edge should be removed from cytoscape
    const edgeCount = await page.evaluate(() => {
      return window.cy.getElementById('node-a->node-b').length;
    });
    expect(edgeCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Edit graph title
// ---------------------------------------------------------------------------

test.describe('Edit graph title', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('title-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('editing title updates graphData.name', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    const titleInput = page.locator('#graph-title');
    await titleInput.fill('Renamed Graph');
    await titleInput.blur();

    const name = await page.evaluate(() => window.graphData.name);
    expect(name).toBe('Renamed Graph');
  });

  test('pressing Enter commits title change', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    const titleInput = page.locator('#graph-title');
    await titleInput.fill('Enter Test');
    await titleInput.press('Enter');

    const name = await page.evaluate(() => window.graphData.name);
    expect(name).toBe('Enter Test');
  });
});

// ---------------------------------------------------------------------------
// 9. Edit node name
// ---------------------------------------------------------------------------

test.describe('Edit node name', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('name-edit-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('editing node name in panel updates data and graph', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Select node-a
    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));

    const nameInput = page.locator('.panel-name-input');
    await nameInput.fill('Renamed Node A');
    await nameInput.blur();

    const name = await page.evaluate(() => window.graphData.nodes['node-a'].name);
    expect(name).toBe('Renamed Node A');

    // Cytoscape label should also update
    const label = await page.evaluate(() => window.cy.getElementById('node-a').data('label'));
    expect(label).toBe('Renamed Node A');
  });
});

// ---------------------------------------------------------------------------
// 10. Edit node description
// ---------------------------------------------------------------------------

test.describe('Edit node description', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('desc-edit-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('editing description in panel updates data', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));

    const textarea = page.locator('#desc-editor');
    await textarea.fill('Updated description text');
    await textarea.blur();

    const desc = await page.evaluate(() => window.graphData.nodes['node-a'].description);
    expect(desc).toBe('Updated description text');
  });
});

// ---------------------------------------------------------------------------
// 11. Change node status
// ---------------------------------------------------------------------------

test.describe('Change node status', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('status-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('clicking status badge opens status modal', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));
    await page.click('.status-badge');

    await expect(page.locator('#edit-status-modal')).toBeVisible();
  });

  test('picking a new status updates node', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));
    await page.click('.status-badge');

    // Click "Solid" status option
    await page.click('.status-option:has-text("Solid")');

    const status = await page.evaluate(() => window.graphData.nodes['node-a'].status);
    expect(status).toBe('solid');

    // Modal should close
    await expect(page.locator('#edit-status-modal')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 12. Delete node
// ---------------------------------------------------------------------------

test.describe('Delete node', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('delete-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('cannot delete node with dependents', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('depended on by');
      await dialog.accept();
    });

    // Right-click node-a (which has dependents b and c)
    await page.evaluate(() => window.cy.getElementById('node-a').emit('cxttap'));

    // Node should still exist
    const exists = await page.evaluate(() => 'node-a' in window.graphData.nodes);
    expect(exists).toBe(true);
  });

  test('deletes leaf node after confirmation', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      }
    });

    // Right-click node-b (leaf node)
    await page.evaluate(() => window.cy.getElementById('node-b').emit('cxttap'));

    // Wait for node removal
    await page.waitForFunction(() => !('node-b' in window.graphData.nodes));
    const count = await page.evaluate(() => window.cy.nodes().length);
    expect(count).toBe(2);
  });

  test('cancelling delete keeps node', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await page.evaluate(() => window.cy.getElementById('node-b').emit('cxttap'));

    // Node should still exist
    const exists = await page.evaluate(() => 'node-b' in window.graphData.nodes);
    expect(exists).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13. Select node → panel opens
// ---------------------------------------------------------------------------

test.describe('Select and deselect node', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('select-test.json', SAMPLE_GRAPH);
  });

  test('clicking node opens panel with correct info', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.evaluate(() => window.cy.getElementById('node-b').emit('tap'));

    const panel = page.locator('#panel');
    await expect(panel).not.toHaveClass(/collapsed/);

    // Node name should be visible in panel
    await expect(page.locator('.panel-name-input')).toHaveValue('Node B');

    // Node ID should be visible
    await expect(page.locator('.node-id')).toHaveText('node-b');

    // Should show prerequisite "Node A"
    await expect(page.locator('.tag:has-text("Node A")')).toBeVisible();
  });

  test('clicking canvas deselects node and closes panel', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Select a node
    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));
    await expect(page.locator('#panel')).not.toHaveClass(/collapsed/);

    // Click empty canvas
    await page.evaluate(() => window.cy.emit('tap'));

    await expect(page.locator('#panel')).toHaveClass(/collapsed/);
  });
});

// ---------------------------------------------------------------------------
// 14. Navigate prereq/dependent tags
// ---------------------------------------------------------------------------

test.describe('Navigate via tags', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('nav-test.json', SAMPLE_GRAPH);
  });

  test('clicking prerequisite tag selects that node', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Select node-b
    await page.evaluate(() => window.cy.getElementById('node-b').emit('tap'));
    await expect(page.locator('.panel-name-input')).toHaveValue('Node B');

    // Click the "Node A" prerequisite tag text
    await page.click('.tag span[onclick*="selectNode"]:has-text("Node A")');

    // Panel should now show Node A
    await expect(page.locator('.panel-name-input')).toHaveValue('Node A');
  });
});

// ---------------------------------------------------------------------------
// 15. Layout switching
// ---------------------------------------------------------------------------

test.describe('Layout switching', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('layout-test.json', SAMPLE_GRAPH);
  });

  test('layout buttons switch active state', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Dagre should be active initially
    await expect(page.locator('#btn-dagre')).toHaveClass(/active/);
    await expect(page.locator('#btn-cose')).not.toHaveClass(/active/);

    // Click Force layout
    await page.click('#btn-cose');
    await expect(page.locator('#btn-cose')).toHaveClass(/active/);
    await expect(page.locator('#btn-dagre')).not.toHaveClass(/active/);

    // Click Radial layout
    await page.click('#btn-concentric');
    await expect(page.locator('#btn-concentric')).toHaveClass(/active/);
    await expect(page.locator('#btn-cose')).not.toHaveClass(/active/);
  });
});

// ---------------------------------------------------------------------------
// 16. Legend highlight filtering
// ---------------------------------------------------------------------------

test.describe('Legend highlight filtering', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('legend-test.json', SAMPLE_GRAPH);
  });

  test('clicking legend item dims other nodes', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    // Click "Solid" in canvas legend
    await page.click('.canvas-legend-item:has-text("Solid")');

    // node-b has status "solid" — it should NOT be dimmed
    const bDimmed = await page.evaluate(() =>
      window.cy.getElementById('node-b').hasClass('dimmed')
    );
    expect(bDimmed).toBe(false);

    // node-a has status "untested" — it should be dimmed
    const aDimmed = await page.evaluate(() =>
      window.cy.getElementById('node-a').hasClass('dimmed')
    );
    expect(aDimmed).toBe(true);
  });

  test('clicking same legend item again removes highlighting', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.click('.canvas-legend-item:has-text("Solid")');
    await page.click('.canvas-legend-item:has-text("Solid")');

    // All nodes should be un-dimmed
    const anyDimmed = await page.evaluate(() =>
      window.cy.nodes().some(n => n.hasClass('dimmed'))
    );
    expect(anyDimmed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 17. Import graph
// ---------------------------------------------------------------------------

test.describe('Import graph', () => {
  test('importing JSON file loads graph', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page, 'Import Test');

    // Set up the file input change handler by clicking Import
    // (importGraph sets onchange then triggers the file dialog)
    // We intercept by setting files before the dialog opens
    const fileInput = page.locator('#file-input');
    const graphJson = JSON.stringify(SAMPLE_GRAPH);
    const buffer = Buffer.from(graphJson, 'utf-8');

    // Register the onchange handler by calling importGraph,
    // but intercept the file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:has-text("Import")'),
    ]);

    await fileChooser.setFiles({
      name: 'test-graph.json',
      mimeType: 'application/json',
      buffer,
    });

    // Wait for graph to load
    await waitForGraph(page, 3);
    const name = await page.evaluate(() => window.graphData.name);
    expect(name).toBe('Test Graph');
  });
});

// ---------------------------------------------------------------------------
// 18. Export graph
// ---------------------------------------------------------------------------

test.describe('Export graph', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('export-test.json', SAMPLE_GRAPH);
  });

  test('export triggers download with correct filename', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export")'),
    ]);

    expect(download.suggestedFilename()).toBe('test-graph.json');
  });
});

// ---------------------------------------------------------------------------
// 19. Canvas hint visibility
// ---------------------------------------------------------------------------

test.describe('Canvas hint', () => {
  test('visible on empty graph, hidden after adding node', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page, 'Hint Test');

    // Hint should be visible (not have 'hidden' class)
    await expect(page.locator('#canvas-hint')).not.toHaveClass(/hidden/);

    // Add a node
    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', 'First Node');
    await page.click('#add-node-modal button.primary');

    // Wait for node to appear in cytoscape
    await waitForGraph(page, 1);

    // Hint should now be hidden
    await expect(page.locator('#canvas-hint')).toHaveClass(/hidden/);
  });
});

// ---------------------------------------------------------------------------
// 20. Modal close behaviours
// ---------------------------------------------------------------------------

test.describe('Modal interactions', () => {
  test('Escape closes open modal', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await expect(page.locator('#add-node-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#add-node-modal')).not.toBeVisible();
  });

  test('clicking overlay closes modal', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await expect(page.locator('#add-node-modal')).toBeVisible();

    // Click the overlay (outside the modal)
    await page.click('#add-node-modal', { position: { x: 10, y: 10 } });
    await expect(page.locator('#add-node-modal')).not.toBeVisible();
  });

  test('cancel button closes add-node modal and clears fields', async ({ page }) => {
    await page.goto('/viewer/');
    await createGraphViaModal(page);

    await page.click('button:has-text("Add Node")');
    await page.fill('#new-node-name', 'Some Name');
    await page.click('#add-node-modal button.ghost');

    await expect(page.locator('#add-node-modal')).not.toBeVisible();

    // Re-open — fields should be cleared
    await page.click('button:has-text("Add Node")');
    await expect(page.locator('#new-node-name')).toHaveValue('');
    await expect(page.locator('#new-node-id')).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// 21. Auto-save persistence
// ---------------------------------------------------------------------------

test.describe('Auto-save', () => {
  test('changes persist to disk', async ({ page }) => {
    const gp = writeFixtureGraph('autosave-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
    await page.goto(`/viewer/?graph=${gp}`);
    await waitForGraph(page, 3);

    // Change the graph name
    const titleInput = page.locator('#graph-title');
    await titleInput.fill('Auto Saved Name');
    await titleInput.blur();

    // Wait for save request to complete
    await page.waitForTimeout(500);

    // Read the file from disk
    const saved = readFixtureGraph('autosave-test.json');
    expect(saved.name).toBe('Auto Saved Name');
  });
});

// ---------------------------------------------------------------------------
// 22. Font size controls
// ---------------------------------------------------------------------------

test.describe('Font size controls', () => {
  let graphPath;

  test.beforeAll(() => {
    graphPath = writeFixtureGraph('font-test.json', SAMPLE_GRAPH);
  });

  test('A+ and A- buttons change node font size', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    const getSize = () => page.evaluate(() => window.nodeFontSize);

    const initial = await getSize();
    await page.click('button:has-text("A+")');
    expect(await getSize()).toBe(initial + 1);

    await page.click('button:has-text("A−")');
    await page.click('button:has-text("A−")');
    expect(await getSize()).toBe(initial - 1);
  });
});

// ---------------------------------------------------------------------------
// 23. Node shape change
// ---------------------------------------------------------------------------

test.describe('Node shape change', () => {
  let graphPath;

  test.beforeEach(async () => {
    graphPath = writeFixtureGraph('shape-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
  });

  test('changing shape in panel updates node', async ({ page }) => {
    await page.goto(`/viewer/?graph=${graphPath}`);
    await waitForGraph(page, 3);

    await page.evaluate(() => window.cy.getElementById('node-a').emit('tap'));
    await page.selectOption('.shape-select', 'diamond');

    const shape = await page.evaluate(() => window.graphData.nodes['node-a'].shape);
    expect(shape).toBe('diamond');

    const cyShape = await page.evaluate(() => window.cy.getElementById('node-a').data('shape'));
    expect(cyShape).toBe('diamond');
  });
});

// ---------------------------------------------------------------------------
// 24. Delete node via panel button
// ---------------------------------------------------------------------------

test.describe('Delete node via panel button', () => {
  test('delete button in panel removes leaf node', async ({ page }) => {
    const gp = writeFixtureGraph('panel-delete-test.json', JSON.parse(JSON.stringify(SAMPLE_GRAPH)));
    await page.goto(`/viewer/?graph=${gp}`);
    await waitForGraph(page, 3);

    // Select leaf node-c
    await page.evaluate(() => window.cy.getElementById('node-c').emit('tap'));

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.click('.panel-footer button.danger');

    await page.waitForFunction(() => window.cy.nodes().length === 2);
    const exists = await page.evaluate(() => 'node-c' in window.graphData.nodes);
    expect(exists).toBe(false);
  });
});
