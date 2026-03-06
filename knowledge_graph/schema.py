"""Validation for skill graph JSON files."""

from __future__ import annotations

VALID_STATUSES = ("untested", "weak", "developing", "solid", "mastered")


class ValidationError(Exception):
    """Raised when graph JSON fails validation."""


def validate(data: dict) -> list[str]:
    """Validate graph JSON structure. Returns list of errors (empty = valid)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["Root must be a JSON object"]

    if "name" not in data:
        errors.append("Missing required field: 'name'")

    nodes = data.get("nodes")
    if nodes is None:
        errors.append("Missing required field: 'nodes'")
        return errors

    if not isinstance(nodes, dict):
        errors.append("'nodes' must be a JSON object (id → node)")
        return errors

    all_ids = set(nodes.keys())

    for node_id, node in nodes.items():
        prefix = f"Node '{node_id}'"

        if not isinstance(node, dict):
            errors.append(f"{prefix}: must be a JSON object")
            continue

        if "name" not in node:
            errors.append(f"{prefix}: missing required field 'name'")

        prereqs = node.get("prerequisites", [])
        if not isinstance(prereqs, list):
            errors.append(f"{prefix}: 'prerequisites' must be a list")
            continue

        for prereq in prereqs:
            if prereq not in all_ids:
                errors.append(
                    f"{prefix}: prerequisite '{prereq}' does not exist"
                )

        status = node.get("status", "untested")
        if status not in VALID_STATUSES:
            errors.append(
                f"{prefix}: invalid status '{status}' "
                f"(must be one of {VALID_STATUSES})"
            )

    return errors
