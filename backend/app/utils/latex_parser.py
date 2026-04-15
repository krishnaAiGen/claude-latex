import re
from dataclasses import dataclass, field


@dataclass
class LatexSection:
    level: str  # "section", "subsection", "subsubsection"
    title: str
    start_line: int
    end_line: int | None = None
    content: str = ""


@dataclass
class LatexStructure:
    preamble_start: int = 0
    preamble_end: int = 0
    document_start: int = 0
    document_end: int = 0
    sections: list[LatexSection] = field(default_factory=list)
    packages: list[str] = field(default_factory=list)
    document_class: str = ""


def parse_latex(content: str) -> LatexStructure:
    lines = content.split("\n")
    structure = LatexStructure()
    current_section: LatexSection | None = None

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Document class
        dc_match = re.match(r"\\documentclass(?:\[.*?\])?\{(.+?)\}", stripped)
        if dc_match:
            structure.document_class = dc_match.group(1)
            structure.preamble_start = i

        # Packages
        pkg_match = re.match(r"\\usepackage(?:\[.*?\])?\{(.+?)\}", stripped)
        if pkg_match:
            structure.packages.append(pkg_match.group(1))

        # Document begin/end
        if stripped == r"\begin{document}":
            structure.preamble_end = i - 1
            structure.document_start = i
        if stripped == r"\end{document}":
            structure.document_end = i
            if current_section:
                current_section.end_line = i - 1
                structure.sections.append(current_section)
                current_section = None

        # Sections
        sec_match = re.match(
            r"\\(section|subsection|subsubsection)\{(.+?)\}", stripped
        )
        if sec_match:
            if current_section:
                current_section.end_line = i - 1
                structure.sections.append(current_section)

            current_section = LatexSection(
                level=sec_match.group(1),
                title=sec_match.group(2),
                start_line=i,
            )

    return structure


def get_structure_summary(content: str) -> str:
    structure = parse_latex(content)
    lines = [f"Document class: {structure.document_class}"]
    lines.append(f"Packages: {', '.join(structure.packages)}")
    lines.append(f"Preamble: lines {structure.preamble_start}-{structure.preamble_end}")
    lines.append(
        f"Document body: lines {structure.document_start}-{structure.document_end}"
    )
    lines.append("Sections:")
    for sec in structure.sections:
        indent = "  " if sec.level == "section" else "    "
        lines.append(
            f"{indent}{sec.title} ({sec.level}, lines {sec.start_line}-{sec.end_line})"
        )
    return "\n".join(lines)
