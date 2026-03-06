# knowledge-graph

A directed acyclic graph (DAG) for tracking skills, knowledge, or any domain where nodes have prerequisites. Includes a Python library for validation/querying and a browser-based viewer/editor.

## Quick start

```bash
# Run the viewer
node server.js
# Open http://localhost:8765/viewer/?graph=examples/algorithms.json
```

```python
# Python library
from knowledge_graph import SkillGraph

g = SkillGraph("examples/algorithms.json")
print(g.frontier())        # nodes ready to learn next
print(g.path_to("bfs"))    # learning path to a target
g.update_status("arrays-and-lists", "mastered")
g.save()
```

## JSON schema

A graph is a single JSON file with this structure:

```json
{
  "name": "Graph Name",
  "description": "Optional description",
  "statuses": [],
  "nodes": {}
}
```

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Human-readable graph name |
| `description` | string | no | What this graph is for |
| `statuses` | array | no | Custom status scheme (see below). If omitted, defaults are used |
| `nodes` | object | yes | Map of node ID to node object |

### Node object

Each key in `nodes` is a kebab-case ID. The value:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Human-readable display name |
| `description` | string | no | What this node represents |
| `prerequisites` | array of string | no | Node IDs that must come before this one. Defaults to `[]` |
| `status` | string | no | One of the valid status IDs. Defaults to the first status |
| `last_tested` | string or null | no | ISO date of last assessment |
| `exercise_series` | string or null | no | Path to associated exercises |
| `position` | object | no | Viewer position: `{"x": number, "y": number}` |

### Statuses

If omitted, these defaults are used:

| ID | Label | Colour | Meaning |
|----|-------|--------|---------|
| `untested` | Untested | `#3a3a4a` | Not yet assessed |
| `weak` | Weak | `#e5484d` | Attempted, needs work |
| `developing` | Developing | `#f5a623` | Partial understanding |
| `solid` | Solid | `#46a758` | Confident |
| `mastered` | Mastered | `#3e63dd` | Fully internalised |

To define custom statuses, add a `statuses` array at the top level. Each entry:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier, used in node `status` fields |
| `label` | string | yes | Display label in the viewer |
| `color` | string | yes | Hex colour for the node background |

Example with custom statuses:

```json
{
  "name": "Literature Gap Analysis",
  "statuses": [
    { "id": "unexplored",  "label": "Unexplored",  "color": "#3a3a4a" },
    { "id": "surveyed",    "label": "Surveyed",     "color": "#f5a623" },
    { "id": "gap_found",   "label": "Gap Found",    "color": "#46a758" },
    { "id": "saturated",   "label": "Saturated",    "color": "#e5484d" },
    { "id": "selected",    "label": "Selected",     "color": "#3e63dd" }
  ],
  "nodes": {
    "protein-engineering": {
      "name": "Protein Engineering",
      "description": "Directed evolution and rational design",
      "prerequisites": [],
      "status": "surveyed"
    }
  }
}
```

### Rules

- **No cycles** — the graph must be a DAG. A node cannot transitively depend on itself.
- **Prerequisites must exist** — every ID in `prerequisites` must be a key in `nodes`.
- **Statuses must be valid** — every node's `status` must be one of the defined status IDs (custom or default).
- **First status is the default** — new nodes get the first status in the list.
- **Frontier** — only computed with the default status scheme. With custom statuses, frontier detection is disabled (it's a manual concept).

## Viewer

Interactive browser-based editor at `viewer/`. Requires `node server.js` for persistence (auto-saves edits to disk).

Features: pan/zoom, drag nodes, hierarchical/force/concentric layouts, click to inspect, status editing, add/delete nodes, import/export JSON, font size controls.

## Python library

```bash
pip install -e .
```

Key methods on `SkillGraph`:
- `frontier()` — nodes ready to learn (default scheme only)
- `path_to(target)` — ordered learning path to a node
- `learning_order()` — full topological sort
- `add_node()`, `remove_node()`, `update_status()` — mutations
- `save()` — persist to disk
- `to_dot()` — Graphviz DOT output