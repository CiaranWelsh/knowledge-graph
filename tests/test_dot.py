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
    assert "#4dabf7" in dot  # mastered = blue
    assert "#ff6b6b" in dot  # weak = red


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
