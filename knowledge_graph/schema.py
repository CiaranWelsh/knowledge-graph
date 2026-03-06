"""Validation for skill graph JSON files."""

from __future__ import annotations

DEFAULT_STATUSES = (
    {"id": "untested", "label": "Untested", "color": "#3a3a4a"},
    {"id": "weak", "label": "Weak", "color": "#e5484d"},
    {"id": "developing", "label": "Developing", "color": "#f5a623"},
    {"id": "solid", "label": "Solid", "color": "#46a758"},
    {"id": "mastered", "label": "Mastered", "color": "#3e63dd"},
)

# Keep for backward compat — tuple of default status ids
VALID_STATUSES = tuple(s["id"] for s in DEFAULT_STATUSES)


def get_valid_status_ids(data: dict) -> tuple[str, ...]:
    """Return the valid status IDs for a graph — custom if defined, else defaults."""
    custom = data.get("statuses")
    if custom and isinstance(custom, list):
        return tuple(s["id"] for s in custom if isinstance(s, dict) and "id" in s)
    return VALID_STATUSES


class ValidationError(Exception):
    """Raised when graph JSON fails validation."""


def validate(data: dict) -> list[str]:
    """Validate graph JSON structure. Returns list of errors (empty = valid)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["Root must be a JSON object"]

    if "name" not in data:
        errors.append("Missing required field: 'name'")

    # Validate custom statuses if present
    custom_statuses = data.get("statuses")
    if custom_statuses is not None:
        if not isinstance(custom_statuses, list):
            errors.append("'statuses' must be a JSON array")
        else:
            seen_ids: set[str] = set()
            for i, s in enumerate(custom_statuses):
                if not isinstance(s, dict):
                    errors.append(f"statuses[{i}]: must be a JSON object")
                    continue
                if "id" not in s:
                    errors.append(f"statuses[{i}]: missing required field 'id'")
                elif s["id"] in seen_ids:
                    errors.append(f"statuses[{i}]: duplicate id '{s['id']}'")
                else:
                    seen_ids.add(s["id"])
                if "label" not in s:
                    errors.append(f"statuses[{i}]: missing required field 'label'")
                if "color" not in s:
                    errors.append(f"statuses[{i}]: missing required field 'color'")

    valid_ids = get_valid_status_ids(data)

    nodes = data.get("nodes")
    if nodes is None:
        errors.append("Missing required field: 'nodes'")
        return errors

    if not isinstance(nodes, dict):
        errors.append("'nodes' must be a JSON object (id → node)")
        return errors

    all_ids = set(nodes.keys())
    default_status = valid_ids[0] if valid_ids else "untested"

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

        status = node.get("status", default_status)
        if status not in valid_ids:
            errors.append(
                f"{prefix}: invalid status '{status}' "
                f"(must be one of {valid_ids})"
            )

    return errors
