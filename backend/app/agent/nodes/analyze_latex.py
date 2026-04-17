from app.agent.state import AgentState
from app.utils.latex_parser import get_structure_summary, parse_latex
from app.utils.reference_map import build_reference_map, reference_map_summary


async def analyze_latex(state: AgentState) -> dict:
    content = state["latex_content"]

    # Build skeleton
    skeleton = get_structure_summary(content)

    # Build reference map
    structure = parse_latex(content)
    sections_for_map = [
        {"title": s.title, "start_line": s.start_line, "end_line": s.end_line}
        for s in structure.sections
    ]
    ref_map = build_reference_map(content, sections_for_map)
    ref_summary = reference_map_summary(ref_map)

    print(f"[ANALYZE] Sections: {len(structure.sections)} | References: {len(ref_map)}")

    return {
        "skeleton": skeleton,
        "ref_map_summary": ref_summary,
    }
