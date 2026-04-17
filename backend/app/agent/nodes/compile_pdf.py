from dataclasses import asdict

from app.agent.state import AgentState
from app.services.compiler import compile_latex


async def compile_pdf(state: AgentState) -> dict:
    content = state.get("modified_latex") or state["latex_content"]
    print(f"[COMPILE] Starting pdflatex ({len(content)} chars)...")
    result = await compile_latex(state["user_id"], state["project_id"], content)
    print(f"[COMPILE] Result: {'SUCCESS' if result.success else 'FAILED'} | Errors: {len(result.errors)}")
    if result.errors:
        for e in result.errors[:3]:
            print(f"[COMPILE]   - {e.message[:80]}")

    return {
        "compilation_result": {
            "success": result.success,
            "pdf_url": f"/api/projects/{state['project_id']}/pdf" if result.success else None,
            "errors": [asdict(e) for e in result.errors],
            "warnings": result.warnings,
            "log": result.log[:2000],  # Truncate long logs
        }
    }
