"""Generate Graphviz DOT strings from a skill graph."""

from __future__ import annotations

from .schema import DEFAULT_STATUSES

# Default status → fill colour (for graphs without custom statuses)
_STATUS_COLOURS = {s["id"]: s["color"] for s in DEFAULT_STATUSES}

_FONT_COLOURS = {
    "untested": "#333333",
    "weak": "#ffffff",
    "developing": "#333333",
    "solid": "#333333",
    "mastered": "#ffffff",
}


def _build_colour_map(data: dict) -> dict[str, str]:
    """Build status→colour map from custom statuses or defaults."""
    custom = data.get("statuses")
    if custom and isinstance(custom, list):
        return {s["id"]: s["color"] for s in custom if isinstance(s, dict) and "id" in s and "color" in s}
    return _STATUS_COLOURS


def _contrast_colour(hex_bg: str) -> str:
    """Return black or white depending on background luminance."""
    h = hex_bg.lstrip("#")
    if len(h) != 6:
        return "#333333"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#333333" if luminance > 0.5 else "#ffffff"


def generate_dot(data: dict, frontier_ids: set[str] | None = None) -> str:
    """Generate a Graphviz DOT string from graph data.

    Args:
        data: The full graph JSON dict.
        frontier_ids: Node IDs currently on the learning frontier
                      (highlighted with bold border).
    """
    frontier_ids = frontier_ids or set()
    colour_map = _build_colour_map(data)

    lines = [
        "digraph {",
        '  rankdir=TB;',
        '  node [shape=box, style="filled,rounded", fontname="Helvetica"];',
        '  edge [color="#666666"];',
        "",
    ]

    nodes = data.get("nodes", {})

    for node_id, node in nodes.items():
        status = node.get("status", "untested")
        fill = colour_map.get(status, "#d3d3d3")
        font_colour = _FONT_COLOURS.get(status) or _contrast_colour(fill)
        label = node.get("name", node_id)

        attrs = [
            f'label="{label}"',
            f'fillcolor="{fill}"',
            f'fontcolor="{font_colour}"',
        ]

        if node_id in frontier_ids:
            attrs.append('penwidth=3')
            attrs.append('color="#222222"')

        attr_str = ", ".join(attrs)
        lines.append(f'  "{node_id}" [{attr_str}];')

    lines.append("")

    # Edges: node → prerequisite (arrow points to what it depends on)
    for node_id, node in nodes.items():
        for prereq in node.get("prerequisites", []):
            lines.append(f'  "{node_id}" -> "{prereq}";')

    lines.append("}")
    return "\n".join(lines)
