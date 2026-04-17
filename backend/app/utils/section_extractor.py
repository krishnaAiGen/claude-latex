"""Extract specific sections from a LaTeX document by name or line range."""

from app.utils.latex_parser import parse_latex


def extract_sections(content: str, section_names: list[str], include_preamble: bool = False) -> str:
    """Extract named sections from a LaTeX document.

    Returns the extracted text with line numbers, preserving context.
    If a section isn't found by name, falls back to returning the full document.
    """
    lines = content.split("\n")
    structure = parse_latex(content)
    extracted_ranges: list[tuple[int, int]] = []

    # Always include first/last lines for document boundaries
    if include_preamble and structure.preamble_start and structure.preamble_end:
        extracted_ranges.append((structure.preamble_start, structure.preamble_end))

    # Match requested sections by name (case-insensitive partial match)
    for target in section_names:
        target_lower = target.lower().strip()
        for sec in structure.sections:
            if target_lower in sec.title.lower() or sec.title.lower() in target_lower:
                start = sec.start_line
                end = sec.end_line or structure.document_end or len(lines)
                # Include 2 lines before section start for context
                start = max(1, start - 2)
                extracted_ranges.append((start, end))

    if not extracted_ranges:
        # No sections matched — return full document
        return _numbered(lines)

    # Merge overlapping ranges
    extracted_ranges.sort()
    merged: list[tuple[int, int]] = [extracted_ranges[0]]
    for start, end in extracted_ranges[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end + 3:  # merge if within 3 lines
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))

    # Always include \end{document} line
    if structure.document_end:
        last_range = merged[-1]
        if structure.document_end > last_range[1]:
            merged.append((structure.document_end - 1, structure.document_end))

    # Build output with line numbers and gap markers
    parts: list[str] = []
    for i, (start, end) in enumerate(merged):
        if i > 0:
            parts.append("  ... (lines omitted) ...")
        for line_num in range(start, min(end + 1, len(lines) + 1)):
            parts.append(f"{line_num:4d} | {lines[line_num - 1]}")

    return "\n".join(parts)


def extract_full_document(content: str) -> str:
    """Return full document with line numbers."""
    return _numbered(content.split("\n"))


def _numbered(lines: list[str]) -> str:
    return "\n".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))
