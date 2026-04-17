import json
import time
import traceback

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from langchain_core.messages import HumanMessage

import app.agent.graph as agent_module
from app.agent.state import AgentState
from app.services.document_store import read_document
from app.services.auth import decode_token

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(default=""), project_id: str = Query(default="")):
    # Validate JWT from query param
    payload = decode_token(token) if token else None
    if not payload or "sub" not in payload:
        await ws.close(code=4001, reason="Unauthorized")
        return
    if not project_id:
        await ws.close(code=4002, reason="Missing project_id")
        return

    user_id = payload["sub"]
    await ws.accept()

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)

            if data.get("type") != "chat_message":
                continue

            content = data.get("content", "")
            context = data.get("context", {})
            model = data.get("model")  # user-selected model

            print(f"\n{'='*60}")
            print(f"[CHAT] User: {user_id[:8]}... | Project: {project_id[:8]}...")
            print(f"[CHAT] Model: {model or 'default'}")
            print(f"[CHAT] Instruction: {content[:100]}{'...' if len(content) > 100 else ''}")
            if context.get("selected_text"):
                print(f"[CHAT] Selection: {context['selected_text'][:80]}...")
            print(f"{'='*60}")

            # Read current document from S3
            latex_content, _ = read_document(user_id, project_id)
            print(f"[DOC] Loaded main.tex ({len(latex_content)} chars)")

            # Build initial state
            initial_state: AgentState = {
                "messages": [HumanMessage(content=content)],
                "latex_content": latex_content,
                "user_instruction": content,
                "selected_text": context.get("selected_text"),
                "selection_range": context.get("selection_range"),
                "user_id": user_id,
                "project_id": project_id,
                "model": model,
                "classification": None,
                "skeleton": None,
                "ref_map_summary": None,
                "parsed_intent": None,
                "modified_latex": None,
                "raw_patches": None,
                "diff": None,
                "compilation_result": None,
                "response_message": None,
                "retry_count": 0,
            }

            # Thread ID = user + project for conversation continuity
            thread_id = f"{user_id}_{project_id}"
            config = {"configurable": {"thread_id": thread_id}}
            print(f"[THREAD] {thread_id[:20]}...")

            try:
                graph = agent_module.agent_graph
                if graph is None:
                    raise RuntimeError("Agent not initialized yet. Please wait and try again.")

                await ws.send_text(
                    json.dumps({"type": "agent_thinking", "content": "Processing..."})
                )

                # Single run with checkpointer — maintains conversation memory
                final_state = None
                async for chunk in graph.astream(
                    initial_state, config, stream_mode="updates"
                ):
                    # Each chunk is {node_name: state_update}
                    for node_name, state_update in chunk.items():
                        print(f"[STREAM] {time.strftime('%H:%M:%S')} | Node: {node_name}")

                        # Send status for key nodes
                        if node_name in ("compile_pdf", "modify_latex", "parse_instruction"):
                            try:
                                await ws.send_text(
                                    json.dumps({"type": "compile_status", "status": node_name})
                                )
                            except Exception:
                                return

                        # Accumulate final state
                        if final_state is None:
                            final_state = dict(initial_state)
                        final_state.update(state_update)

                if final_state is None:
                    final_state = initial_state

                print(f"[DONE] {time.strftime('%H:%M:%S')}")

                response = {
                    "type": "agent_response",
                    "message": final_state.get("response_message", ""),
                    "latex_content": final_state.get("modified_latex")
                    or final_state.get("latex_content"),
                    "diff": final_state.get("diff"),
                    "pdf_url": (final_state.get("compilation_result") or {}).get(
                        "pdf_url"
                    ),
                    "compilation": final_state.get("compilation_result"),
                }

                try:
                    await ws.send_text(json.dumps(response))
                except Exception:
                    return

            except WebSocketDisconnect:
                print(f"[WS] Client disconnected during processing")
                return
            except Exception as e:
                traceback.print_exc()
                # Send friendly error to frontend
                friendly = "Something went wrong. Please try again."
                print(f"[ERROR] {e}")
                try:
                    await ws.send_text(
                        json.dumps({"type": "error", "message": friendly})
                    )
                except Exception:
                    return

    except WebSocketDisconnect:
        pass
