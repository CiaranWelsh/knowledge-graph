"""Skill dependency graph — a DAG of skills with prerequisite edges."""

from __future__ import annotations

import json
from graphlib import CycleError, TopologicalSorter
from pathlib import Path

from .dot import generate_dot
from .schema import VALID_STATUSES, ValidationError, get_valid_status_ids, validate

# Statuses considered "passed" when computing the frontier (default scheme only)
_PASSED = {"solid", "mastered"}


class SkillGraph:
    """A directed acyclic graph of skills with prerequisite dependencies.

    Nodes are skills. Edges point from a skill to its prerequisites.
    The graph is persisted as JSON and validated on load.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        with open(self._path) as f:
            self._data = json.load(f)

        errors = validate(self._data)
        if errors:
            raise ValidationError(
                f"Invalid graph ({self._path}):\n"
                + "\n".join(f"  - {e}" for e in errors)
            )

        self._validate_dag()

    # --- Persistence ---

    def save(self) -> None:
        """Write the graph back to its JSON file."""
        with open(self._path, "w") as f:
            json.dump(self._data, f, indent=2)
            f.write("\n")

    @property
    def name(self) -> str:
        return self._data.get("name", "")

    @property
    def description(self) -> str:
        return self._data.get("description", "")

    @property
    def nodes(self) -> dict:
        return self._data["nodes"]

    # --- Mutation ---

    def add_node(
        self,
        node_id: str,
        name: str,
        description: str = "",
        prerequisites: list[str] | None = None,
    ) -> None:
        """Add a node. Raises if it would create a cycle or reference missing prereqs."""
        if node_id in self.nodes:
            raise ValueError(f"Node '{node_id}' already exists")

        prereqs = prerequisites or []
        for p in prereqs:
            if p not in self.nodes:
                raise ValueError(
                    f"Prerequisite '{p}' does not exist in graph"
                )

        valid = get_valid_status_ids(self._data)
        default_status = valid[0] if valid else "untested"
        self.nodes[node_id] = {
            "name": name,
            "description": description,
            "prerequisites": prereqs,
            "status": default_status,
            "last_tested": None,
            "exercise_series": None,
        }

        try:
            self._validate_dag()
        except CycleError:
            del self.nodes[node_id]
            raise

    def remove_node(self, node_id: str) -> None:
        """Remove a node. Raises if other nodes depend on it."""
        if node_id not in self.nodes:
            raise KeyError(f"Node '{node_id}' not found")

        dependents = [
            nid
            for nid, node in self.nodes.items()
            if node_id in node.get("prerequisites", [])
        ]
        if dependents:
            raise ValueError(
                f"Cannot remove '{node_id}': "
                f"depended on by {dependents}"
            )

        del self.nodes[node_id]

    def update_status(self, node_id: str, status: str) -> None:
        """Update a node's status."""
        if node_id not in self.nodes:
            raise KeyError(f"Node '{node_id}' not found")
        valid = get_valid_status_ids(self._data)
        if status not in valid:
            raise ValueError(
                f"Invalid status '{status}' (must be one of {valid})"
            )
        self.nodes[node_id]["status"] = status

    # --- Query ---

    def learning_order(self) -> list[str]:
        """Return all node IDs in topological order (prerequisites first)."""
        return list(TopologicalSorter(self._adjacency()).static_order())

    @property
    def _uses_default_scheme(self) -> bool:
        """True if this graph uses the default status scheme (no custom statuses)."""
        return "statuses" not in self._data

    def frontier(self) -> list[str]:
        """Nodes whose prerequisites are all passed but the node itself isn't.

        Only meaningful with the default status scheme. Returns empty list
        for graphs with custom statuses (frontier is a manual concept there).
        """
        if not self._uses_default_scheme:
            return []
        result = []
        for node_id, node in self.nodes.items():
            if node.get("status", "untested") in _PASSED:
                continue
            prereqs = node.get("prerequisites", [])
            if all(
                self.nodes[p].get("status", "untested") in _PASSED
                for p in prereqs
            ):
                result.append(node_id)
        return result

    def prerequisites_for(self, node_id: str) -> list[str]:
        """All transitive prerequisites for a node (topologically ordered)."""
        if node_id not in self.nodes:
            raise KeyError(f"Node '{node_id}' not found")

        visited: set[str] = set()

        def _walk(nid: str) -> None:
            for p in self.nodes[nid].get("prerequisites", []):
                if p not in visited:
                    visited.add(p)
                    _walk(p)

        _walk(node_id)

        # Return in topological order
        full_order = self.learning_order()
        return [nid for nid in full_order if nid in visited]

    def path_to(self, target: str) -> list[str]:
        """Ordered learning path from current frontier to target.

        Only includes nodes that are not yet passed. With custom status
        schemes, all nodes are included (no concept of "passed").
        """
        if target not in self.nodes:
            raise KeyError(f"Node '{target}' not found")

        # All transitive prereqs + the target itself
        needed = set(self.prerequisites_for(target))
        needed.add(target)

        # Filter out already-passed nodes (only with default scheme)
        if self._uses_default_scheme:
            to_learn = {
                nid
                for nid in needed
                if self.nodes[nid].get("status", "untested") not in _PASSED
            }
        else:
            to_learn = needed

        # Return in topological order
        full_order = self.learning_order()
        return [nid for nid in full_order if nid in to_learn]

    # --- Visualisation ---

    def to_dot(self) -> str:
        """Generate a Graphviz DOT string."""
        frontier_ids = set(self.frontier())
        return generate_dot(self._data, frontier_ids)

    def render_svg(self, output: str | Path) -> Path:
        """Render the graph to SVG using system graphviz."""
        import subprocess

        output = Path(output)
        dot_str = self.to_dot()
        dot_path = output.with_suffix(".dot")
        dot_path.write_text(dot_str)

        result = subprocess.run(
            ["dot", "-Tsvg", str(dot_path), "-o", str(output)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"graphviz failed: {result.stderr}\n"
                "Install with: brew install graphviz"
            )
        return output

    # --- Internal ---

    def _adjacency(self) -> dict[str, set[str]]:
        """Build adjacency dict for TopologicalSorter (node → prerequisites)."""
        return {
            nid: set(node.get("prerequisites", []))
            for nid, node in self.nodes.items()
        }

    def _validate_dag(self) -> None:
        """Raise CycleError if the graph contains a cycle."""
        ts = TopologicalSorter(self._adjacency())
        ts.prepare()  # raises CycleError if cycle exists
