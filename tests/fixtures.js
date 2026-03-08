/**
 * Test fixtures — sample graph data and helper utilities.
 */

const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, 'fixture-graphs');

const SAMPLE_GRAPH = {
  name: "Test Graph",
  nodes: {
    "node-a": {
      name: "Node A",
      description: "First node",
      prerequisites: [],
      status: "untested",
    },
    "node-b": {
      name: "Node B",
      description: "Second node",
      prerequisites: ["node-a"],
      status: "solid",
    },
    "node-c": {
      name: "Node C",
      description: "Third node",
      prerequisites: ["node-a"],
      status: "untested",
    },
  },
};

function setupFixtureDir() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
}

function writeFixtureGraph(filename, data) {
  setupFixtureDir();
  const filePath = path.join(FIXTURE_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  // Return path relative to repo root for ?graph= param
  return `tests/fixture-graphs/${filename}`;
}

function readFixtureGraph(filename) {
  const filePath = path.join(FIXTURE_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function cleanupFixtures() {
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
}

module.exports = {
  SAMPLE_GRAPH,
  FIXTURE_DIR,
  writeFixtureGraph,
  readFixtureGraph,
  cleanupFixtures,
  setupFixtureDir,
};
