"""Generate Graphviz DOT strings from a skill graph."""

from __future__ import annotations

# Status → fill colour
_STATUS_COLOURS = {
    "untested": "#d3d3d3",    # light grey
    "weak": "#ff6b6b",        # red
    "developing": "#ffa94d",  # orange
    "solid": "#69db7c",       # green
    "mastered": "#4dabf7",    # blue
}

_FONT_COLOURS = {
    "untested": "#333333",
    "weak": "#ffffff",
    "developing": "#333333",
    "solid": "#333333",
    "mastered": "#ffffff",
}


def generate_dot(data: dict, frontier_ids: set[str] | None = None) -> str:
    """Generate a Graphviz DOT string from graph data.

    Args:
        data: The full graph JSON dict.
        frontier_ids: Node IDs currently on the learning frontier
                      (highlighted with bold border).
    """
    frontier_ids = frontier_ids or set()
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
        fill = _STATUS_COLOURS.get(status, "#d3d3d3")
        font_colour = _FONT_COLOURS.get(status, "#333333")
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
