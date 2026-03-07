"""Tests for the JSON Schema file against real and synthetic graphs."""

import json

import jsonschema
import pytest


@pytest.fixture
def schema():
    with open("schema/graph.schema.json") as f:
        return json.load(f)


# --- Valid graphs ---


class TestValidGraphs:
    def test_minimal_graph(self, schema):
        jsonschema.validate({"name": "T", "nodes": {}}, schema)

    def test_existing_algorithms(self, schema):
        with open("examples/algorithms.json") as f:
            jsonschema.validate(json.load(f), schema)

    def test_existing_pattern_taxonomy(self, schema):
        with open("examples/pattern-taxonomy.json") as f:
            jsonschema.validate(json.load(f), schema)

    def test_custom_statuses(self, schema):
        g = {
            "name": "T",
            "statuses": [
                {"id": "new", "label": "New", "color": "#aabbcc"},
            ],
            "nodes": {"a": {"name": "A", "status": "new"}},
        }
        jsonschema.validate(g, schema)

    def test_dimensions(self, schema):
        g = {
            "name": "T",
            "dimensions": [
                {
                    "id": "lang",
                    "label": "Language",
                    "values": [
                        {"id": "py", "label": "Python", "color": "#3572a5"},
                    ],
                }
            ],
            "nodes": {
                "a": {"name": "A", "dimensions": {"lang": "py"}},
                "b": {"name": "B", "dimensions": {"lang": None}},
                "c": {"name": "C"},
            },
        }
        jsonschema.validate(g, schema)

    def test_node_with_all_fields(self, schema):
        g = {
            "name": "T",
            "nodes": {
                "a": {
                    "name": "A",
                    "description": "desc",
                    "prerequisites": [],
                    "status": "untested",
                    "last_tested": None,
                    "exercise_series": None,
                    "shape": "diamond",
                    "dimensions": {},
                    "position": {"x": 100, "y": 200},
                }
            },
        }
        jsonschema.validate(g, schema)

    def test_all_shapes_valid(self, schema):
        shapes = [
            "ellipse", "triangle", "round-triangle", "rectangle",
            "round-rectangle", "diamond", "hexagon", "star", "tag", "vee",
        ]
        for shape in shapes:
            g = {"name": "T", "nodes": {"a": {"name": "A", "shape": shape}}}
            jsonschema.validate(g, schema)


# --- Invalid graphs ---


class TestInvalidGraphs:
    def test_missing_name(self, schema):
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate({"nodes": {}}, schema)

    def test_missing_nodes(self, schema):
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate({"name": "T"}, schema)

    def test_extra_top_level_field(self, schema):
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(
                {"name": "T", "nodes": {}, "bogus": True}, schema
            )

    def test_invalid_shape(self, schema):
        g = {"name": "T", "nodes": {"a": {"name": "A", "shape": "banana"}}}
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)

    def test_bad_status_color_format(self, schema):
        g = {
            "name": "T",
            "statuses": [{"id": "x", "label": "X", "color": "red"}],
            "nodes": {},
        }
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)

    def test_dimension_value_bad_color(self, schema):
        g = {
            "name": "T",
            "dimensions": [{
                "id": "d",
                "label": "D",
                "values": [{"id": "v", "label": "V", "color": "#xyz"}],
            }],
            "nodes": {},
        }
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)

    def test_extra_node_field(self, schema):
        g = {
            "name": "T",
            "nodes": {"a": {"name": "A", "bogus": True}},
        }
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)

    def test_position_missing_y(self, schema):
        g = {
            "name": "T",
            "nodes": {"a": {"name": "A", "position": {"x": 1}}},
        }
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)

    def test_dimension_missing_label(self, schema):
        g = {
            "name": "T",
            "dimensions": [{
                "id": "d",
                "values": [{"id": "v", "label": "V", "color": "#000000"}],
            }],
            "nodes": {},
        }
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(g, schema)
