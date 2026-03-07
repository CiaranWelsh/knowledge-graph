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

    # Validate dimensions if present
    dim_valid_values: dict[str, set[str]] = {}  # dim_id → set of valid value ids
    dimensions = data.get("dimensions")
    if dimensions is not None:
        if not isinstance(dimensions, list):
            errors.append("'dimensions' must be a JSON array")
        else:
            seen_dim_ids: set[str] = set()
            for i, dim in enumerate(dimensions):
                if not isinstance(dim, dict):
                    errors.append(f"dimensions[{i}]: must be a JSON object")
                    continue
                dim_id = dim.get("id")
                if dim_id is None:
                    errors.append(f"dimensions[{i}]: missing required field 'id'")
                elif dim_id in seen_dim_ids:
                    errors.append(f"dimensions[{i}]: duplicate id '{dim_id}'")
                else:
                    seen_dim_ids.add(dim_id)
                if "label" not in dim:
                    errors.append(f"dimensions[{i}]: missing required field 'label'")
                values = dim.get("values")
                if values is None:
                    errors.append(f"dimensions[{i}]: missing required field 'values'")
                elif not isinstance(values, list):
                    errors.append(f"dimensions[{i}]: 'values' must be a list")
                elif dim_id is not None:
                    seen_val_ids: set[str] = set()
                    for j, v in enumerate(values):
                        if not isinstance(v, dict):
                            errors.append(f"dimensions[{i}].values[{j}]: must be a JSON object")
                            continue
                        val_id = v.get("id")
                        if val_id is None:
                            errors.append(f"dimensions[{i}].values[{j}]: missing 'id'")
                        elif val_id in seen_val_ids:
                            errors.append(f"dimensions[{i}].values[{j}]: duplicate id '{val_id}'")
                        else:
                            seen_val_ids.add(val_id)
                        if "label" not in v:
                            errors.append(f"dimensions[{i}].values[{j}]: missing 'label'")
                        if "color" not in v:
                            errors.append(f"dimensions[{i}].values[{j}]: missing 'color'")
                    dim_valid_values[dim_id] = seen_val_ids

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

        # Validate node dimension values
        node_dims = node.get("dimensions")
        if node_dims is not None:
            if not isinstance(node_dims, dict):
                errors.append(f"{prefix}: 'dimensions' must be a JSON object")
            else:
                for dim_id, val_id in node_dims.items():
                    if val_id is None:
                        continue  # null = unassigned, always valid
                    if dim_id not in dim_valid_values:
                        errors.append(
                            f"{prefix}: unknown dimension '{dim_id}'"
                        )
                    elif val_id not in dim_valid_values[dim_id]:
                        errors.append(
                            f"{prefix}: invalid value '{val_id}' for "
                            f"dimension '{dim_id}'"
                        )

    return errors
