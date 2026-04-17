"""Build a dependency map of labels, references, and citations in a LaTeX document."""

import re
from dataclasses import dataclass, field


@dataclass
class RefEntry:
    label: str
    defined_at: int | None = None  # line number
    defined_in: str | None = None  # section name
    referenced_at: list[dict] = field(default_factory=list)  # [{line, section}]


def build_reference_map(content: str, sections: list[dict]) -> dict[str, RefEntry]:
    """Scan document for \\label, \\ref, \\eqref, \\cite and build dependency map."""
    lines = content.split("\n")
    refs: dict[str, RefEntry] = {}

    def _section_for_line(line_num: int) -> str | None:
        """Find which section a line belongs to."""
        for sec in reversed(sections):
            if line_num >= sec.get("start_line", 0):
                return sec.get("title", "Unknown")
        return None

    # Pass 1: Find all \label definitions
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r"\\label\{([^}]+)\}", line):
            label = m.group(1)
            refs[label] = RefEntry(
                label=label,
                defined_at=i,
                defined_in=_section_for_line(i),
            )

    # Pass 2: Find all references (\ref, \eqref, \pageref, \autoref)
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r"\\(?:eq)?ref\{([^}]+)\}", line):
            label = m.group(1)
            if label not in refs:
                refs[label] = RefEntry(label=label)
            refs[label].referenced_at.append({
                "line": i,
                "section": _section_for_line(i),
            })

    # Pass 3: Find all citations (\cite, \citep, \citet)
    for i, line in enumerate(lines, 1):
        for m in re.finditer(r"\\cite[pt]?\{([^}]+)\}", line):
            keys = [k.strip() for k in m.group(1).split(",")]
            for key in keys:
                cite_label = f"cite:{key}"
                if cite_label not in refs:
                    refs[cite_label] = RefEntry(label=cite_label)
                refs[cite_label].referenced_at.append({
                    "line": i,
                    "section": _section_for_line(i),
                })

    return refs


def reference_map_summary(refs: dict[str, RefEntry]) -> str:
    """Format reference map as a concise string for LLM consumption."""
    if not refs:
        return "No labels, references, or citations found."

    lines = ["Dependencies:"]
    for label, entry in refs.items():
        if entry.defined_at:
            loc = f"defined at line {entry.defined_at}"
            if entry.defined_in:
                loc += f" ({entry.defined_in})"
        else:
            loc = "defined externally"

        ref_parts = []
        for r in entry.referenced_at:
            s = f"line {r['line']}"
            if r.get("section"):
                s += f" ({r['section']})"
            ref_parts.append(s)

        if ref_parts:
            lines.append(f"  {label}: {loc} → referenced at {', '.join(ref_parts)}")
        elif entry.defined_at:
            lines.append(f"  {label}: {loc} (unreferenced)")

    return "\n".join(lines)
