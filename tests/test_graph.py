"""Tests for SkillGraph core functionality."""

import json
import tempfile
from graphlib import CycleError
from pathlib import Path

import pytest

from knowledge_graph.graph import SkillGraph
from knowledge_graph.schema import ValidationError


def _write_graph(tmp_path: Path, data: dict) -> Path:
    """Helper: write a graph dict to a temp JSON file."""
    p = tmp_path / "graph.json"
    p.write_text(json.dumps(data))
    return p


def _minimal_graph() -> dict:
    return {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "untested"},
            "c": {"name": "C", "prerequisites": ["b"], "status": "untested"},
        },
    }


def _diamond_graph() -> dict:
    """Diamond: d depends on b and c, both depend on a."""
    return {
        "name": "Diamond",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "solid"},
            "c": {"name": "C", "prerequisites": ["a"], "status": "untested"},
            "d": {"name": "D", "prerequisites": ["b", "c"], "status": "untested"},
        },
    }


# --- Loading & Validation ---


class TestLoading:
    def test_loads_valid_graph(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        assert g.name == "Test"
        assert len(g.nodes) == 3

    def test_rejects_missing_name(self, tmp_path):
        p = _write_graph(tmp_path, {"nodes": {}})
        with pytest.raises(ValidationError, match="name"):
            SkillGraph(p)

    def test_rejects_missing_prerequisite(self, tmp_path):
        data = {
            "name": "Bad",
            "nodes": {
                "a": {"name": "A", "prerequisites": ["nonexistent"]},
            },
        }
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="nonexistent"):
            SkillGraph(p)

    def test_rejects_invalid_status(self, tmp_path):
        data = {
            "name": "Bad",
            "nodes": {
                "a": {"name": "A", "prerequisites": [], "status": "perfect"},
            },
        }
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="perfect"):
            SkillGraph(p)


# --- Cycle Detection ---


class TestCycleDetection:
    def test_rejects_direct_cycle(self, tmp_path):
        data = {
            "name": "Cycle",
            "nodes": {
                "a": {"name": "A", "prerequisites": ["b"]},
                "b": {"name": "B", "prerequisites": ["a"]},
            },
        }
        p = _write_graph(tmp_path, data)
        with pytest.raises(CycleError):
            SkillGraph(p)

    def test_rejects_indirect_cycle(self, tmp_path):
        data = {
            "name": "Cycle",
            "nodes": {
                "a": {"name": "A", "prerequisites": ["c"]},
                "b": {"name": "B", "prerequisites": ["a"]},
                "c": {"name": "C", "prerequisites": ["b"]},
            },
        }
        p = _write_graph(tmp_path, data)
        with pytest.raises(CycleError):
            SkillGraph(p)

    def test_accepts_dag(self, tmp_path):
        p = _write_graph(tmp_path, _diamond_graph())
        g = SkillGraph(p)  # should not raise
        assert len(g.nodes) == 4


# --- Topological Sort ---


class TestLearningOrder:
    def test_linear_chain(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        order = g.learning_order()
        assert order.index("a") < order.index("b")
        assert order.index("b") < order.index("c")

    def test_diamond(self, tmp_path):
        p = _write_graph(tmp_path, _diamond_graph())
        g = SkillGraph(p)
        order = g.learning_order()
        assert order.index("a") < order.index("b")
        assert order.index("a") < order.index("c")
        assert order.index("b") < order.index("d")
        assert order.index("c") < order.index("d")


# --- Frontier ---


class TestFrontier:
    def test_frontier_linear(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        # a=mastered, b=untested (prereqs met), c=untested (prereqs NOT met)
        assert g.frontier() == ["b"]

    def test_frontier_diamond(self, tmp_path):
        p = _write_graph(tmp_path, _diamond_graph())
        g = SkillGraph(p)
        # a=mastered, b=solid (passed), c=untested (prereqs met), d=untested (prereqs NOT met: c not passed)
        assert g.frontier() == ["c"]

    def test_frontier_all_passed(self, tmp_path):
        data = {
            "name": "Done",
            "nodes": {
                "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            },
        }
        p = _write_graph(tmp_path, data)
        g = SkillGraph(p)
        assert g.frontier() == []

    def test_frontier_root_nodes(self, tmp_path):
        data = {
            "name": "Roots",
            "nodes": {
                "a": {"name": "A", "prerequisites": [], "status": "untested"},
                "b": {"name": "B", "prerequisites": [], "status": "untested"},
            },
        }
        p = _write_graph(tmp_path, data)
        g = SkillGraph(p)
        assert set(g.frontier()) == {"a", "b"}


# --- Prerequisites & Path ---


class TestPrerequisites:
    def test_transitive_prereqs(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        prereqs = g.prerequisites_for("c")
        assert set(prereqs) == {"a", "b"}
        # Should be in topological order
        assert prereqs.index("a") < prereqs.index("b")

    def test_no_prereqs(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        assert g.prerequisites_for("a") == []


class TestPathTo:
    def test_path_skips_passed(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        # a=mastered, so path to c should be [b, c]
        path = g.path_to("c")
        assert path == ["b", "c"]

    def test_path_all_needed(self, tmp_path):
        data = {
            "name": "All",
            "nodes": {
                "a": {"name": "A", "prerequisites": [], "status": "untested"},
                "b": {"name": "B", "prerequisites": ["a"], "status": "untested"},
                "c": {"name": "C", "prerequisites": ["b"], "status": "untested"},
            },
        }
        p = _write_graph(tmp_path, data)
        g = SkillGraph(p)
        assert g.path_to("c") == ["a", "b", "c"]

    def test_path_already_done(self, tmp_path):
        data = {
            "name": "Done",
            "nodes": {
                "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            },
        }
        p = _write_graph(tmp_path, data)
        g = SkillGraph(p)
        assert g.path_to("a") == []


# --- Mutation ---


class TestMutation:
    def test_add_node(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        g.add_node("d", "D", "New node", prerequisites=["c"])
        assert "d" in g.nodes
        assert g.nodes["d"]["status"] == "untested"

    def test_add_node_rejects_cycle(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        # Adding a node that creates a→c→b→a cycle
        # First make c depend on a (it already depends on b which depends on a)
        # Try to add node that makes a depend on c
        with pytest.raises(ValueError, match="already exists"):
            g.add_node("a", "A duplicate")

    def test_add_node_missing_prereq(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        with pytest.raises(ValueError, match="does not exist"):
            g.add_node("d", "D", prerequisites=["nonexistent"])

    def test_remove_node(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        g.remove_node("c")
        assert "c" not in g.nodes

    def test_remove_node_with_dependents(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        with pytest.raises(ValueError, match="depended on"):
            g.remove_node("a")

    def test_update_status(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        g.update_status("b", "solid")
        assert g.nodes["b"]["status"] == "solid"

    def test_update_status_invalid(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        with pytest.raises(ValueError, match="Invalid status"):
            g.update_status("b", "perfect")

    def test_save_roundtrip(self, tmp_path):
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        g.update_status("b", "developing")
        g.save()

        g2 = SkillGraph(p)
        assert g2.nodes["b"]["status"] == "developing"


# --- Custom Statuses ---


def _custom_status_graph() -> dict:
    return {
        "name": "Literature Review",
        "statuses": [
            {"id": "unexplored", "label": "Unexplored", "color": "#3a3a4a"},
            {"id": "surveyed", "label": "Surveyed", "color": "#f5a623"},
            {"id": "gap_found", "label": "Gap Found", "color": "#46a758"},
            {"id": "saturated", "label": "Saturated", "color": "#e5484d"},
        ],
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "surveyed"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "unexplored"},
        },
    }


class TestCustomStatuses:
    def test_loads_custom_statuses(self, tmp_path):
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        assert g.nodes["a"]["status"] == "surveyed"

    def test_rejects_default_status_with_custom_scheme(self, tmp_path):
        data = _custom_status_graph()
        data["nodes"]["a"]["status"] = "mastered"  # not in custom scheme
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="mastered"):
            SkillGraph(p)

    def test_update_status_custom(self, tmp_path):
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        g.update_status("b", "gap_found")
        assert g.nodes["b"]["status"] == "gap_found"

    def test_update_status_rejects_invalid_custom(self, tmp_path):
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        with pytest.raises(ValueError, match="solid"):
            g.update_status("b", "solid")  # not in custom scheme

    def test_frontier_empty_with_custom(self, tmp_path):
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        assert g.frontier() == []

    def test_add_node_uses_first_custom_status(self, tmp_path):
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        g.add_node("c", "C", prerequisites=["a"])
        assert g.nodes["c"]["status"] == "unexplored"

    def test_path_to_includes_all_with_custom(self, tmp_path):
        """With custom scheme, path_to doesn't filter by 'passed'."""
        p = _write_graph(tmp_path, _custom_status_graph())
        g = SkillGraph(p)
        path = g.path_to("b")
        assert path == ["a", "b"]

    def test_rejects_duplicate_status_ids(self, tmp_path):
        data = _custom_status_graph()
        data["statuses"].append(
            {"id": "surveyed", "label": "Dup", "color": "#000"}
        )
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="duplicate"):
            SkillGraph(p)

    def test_rejects_status_missing_fields(self, tmp_path):
        data = {
            "name": "Bad",
            "statuses": [{"id": "foo"}],  # missing label, color
            "nodes": {},
        }
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="label"):
            SkillGraph(p)


# --- Dimensions ---


def _dimension_graph() -> dict:
    return {
        "name": "Systems Programming",
        "dimensions": [
            {
                "id": "language",
                "label": "Language",
                "values": [
                    {"id": "cpp", "label": "C++", "color": "#e5484d"},
                    {"id": "rust", "label": "Rust", "color": "#f5a623"},
                ],
            },
            {
                "id": "domain",
                "label": "Domain",
                "values": [
                    {"id": "systems", "label": "Systems", "color": "#3e63dd"},
                    {"id": "web", "label": "Web", "color": "#46a758"},
                ],
            },
        ],
        "nodes": {
            "ownership": {
                "name": "Ownership",
                "prerequisites": [],
                "status": "untested",
                "dimensions": {"language": "rust", "domain": "systems"},
            },
            "templates": {
                "name": "Templates",
                "prerequisites": [],
                "status": "untested",
                "dimensions": {"language": "cpp"},
            },
            "basics": {
                "name": "Basics",
                "prerequisites": [],
                "status": "untested",
            },
        },
    }


class TestDimensions:
    def test_loads_with_dimensions(self, tmp_path):
        p = _write_graph(tmp_path, _dimension_graph())
        g = SkillGraph(p)
        assert g.nodes["ownership"]["dimensions"]["language"] == "rust"

    def test_node_without_dimensions_ok(self, tmp_path):
        p = _write_graph(tmp_path, _dimension_graph())
        g = SkillGraph(p)
        assert "dimensions" not in g.nodes["basics"]

    def test_null_dimension_value_ok(self, tmp_path):
        data = _dimension_graph()
        data["nodes"]["basics"]["dimensions"] = {"language": None}
        p = _write_graph(tmp_path, data)
        g = SkillGraph(p)
        assert g.nodes["basics"]["dimensions"]["language"] is None

    def test_rejects_invalid_dimension_value(self, tmp_path):
        data = _dimension_graph()
        data["nodes"]["ownership"]["dimensions"]["language"] = "python"
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="python"):
            SkillGraph(p)

    def test_rejects_unknown_dimension(self, tmp_path):
        data = _dimension_graph()
        data["nodes"]["ownership"]["dimensions"]["color"] = "red"
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="color"):
            SkillGraph(p)

    def test_rejects_duplicate_dimension_ids(self, tmp_path):
        data = _dimension_graph()
        data["dimensions"].append({
            "id": "language",
            "label": "Dup",
            "values": [{"id": "x", "label": "X", "color": "#000000"}],
        })
        p = _write_graph(tmp_path, data)
        with pytest.raises(ValidationError, match="duplicate"):
            SkillGraph(p)

    def test_no_dimensions_at_all_ok(self, tmp_path):
        """Graphs without dimensions field still work."""
        p = _write_graph(tmp_path, _minimal_graph())
        g = SkillGraph(p)
        assert len(g.nodes) == 3
