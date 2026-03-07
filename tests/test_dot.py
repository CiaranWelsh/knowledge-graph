"""Tests for DOT generation."""

import json
from pathlib import Path

from knowledge_graph.dot import generate_dot
from knowledge_graph.graph import SkillGraph


def _write_graph(tmp_path: Path, data: dict) -> Path:
    p = tmp_path / "graph.json"
    p.write_text(json.dumps(data))
    return p


def test_dot_contains_all_nodes():
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "Alpha", "prerequisites": [], "status": "mastered"},
            "b": {"name": "Beta", "prerequisites": ["a"], "status": "untested"},
        },
    }
    dot = generate_dot(data)
    assert '"a"' in dot
    assert '"b"' in dot
    assert 'label="Alpha"' in dot
    assert 'label="Beta"' in dot


def test_dot_contains_edges():
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "untested"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "untested"},
        },
    }
    dot = generate_dot(data)
    assert '"b" -> "a"' in dot


def test_dot_frontier_highlighting():
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "untested"},
        },
    }
    dot = generate_dot(data, frontier_ids={"b"})
    # Frontier node should have penwidth
    assert "penwidth=3" in dot


def test_dot_status_colours():
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            "b": {"name": "B", "prerequisites": [], "status": "weak"},
        },
    }
    dot = generate_dot(data)
    assert "#3e63dd" in dot  # mastered = blue
    assert "#e5484d" in dot  # weak = red


def test_dot_custom_statuses():
    """DOT uses colours from custom status scheme."""
    data = {
        "name": "Test",
        "statuses": [
            {"id": "new", "label": "New", "color": "#aabbcc"},
            {"id": "done", "label": "Done", "color": "#112233"},
        ],
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "done"},
            "b": {"name": "B", "prerequisites": [], "status": "new"},
        },
    }
    dot = generate_dot(data)
    assert "#112233" in dot  # done colour
    assert "#aabbcc" in dot  # new colour


def test_dot_unknown_status_fallback():
    """DOT handles unknown status gracefully with fallback colour."""
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mystery"},
        },
    }
    dot = generate_dot(data)
    assert "#d3d3d3" in dot  # fallback grey


def test_to_dot_via_graph(tmp_path):
    data = {
        "name": "Test",
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "mastered"},
            "b": {"name": "B", "prerequisites": ["a"], "status": "untested"},
        },
    }
    p = _write_graph(tmp_path, data)
    g = SkillGraph(p)
    dot = g.to_dot()
    assert "digraph" in dot
    assert '"b" -> "a"' in dot


def test_to_dot_custom_statuses_via_graph(tmp_path):
    """to_dot() works through SkillGraph with custom statuses."""
    data = {
        "name": "Custom",
        "statuses": [
            {"id": "open", "label": "Open", "color": "#ff0000"},
            {"id": "closed", "label": "Closed", "color": "#00ff00"},
        ],
        "nodes": {
            "a": {"name": "A", "prerequisites": [], "status": "open"},
        },
    }
    p = _write_graph(tmp_path, data)
    g = SkillGraph(p)
    dot = g.to_dot()
    assert "#ff0000" in dot
    # Frontier should be empty with custom scheme
    assert "penwidth" not in dot
