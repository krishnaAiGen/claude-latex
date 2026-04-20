import json
import time
import traceback
from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from langchain_core.messages import HumanMessage
from sqlalchemy import select

import app.agent.graph as agent_module
from app.agent.state import AgentState
from app.db import AsyncSessionLocal
from app.models.user import Project
from app.services.document_store import read_document
from app.services.auth import decode_token

router = APIRouter()

# In-memory room registry: project_id → set of WebSocket connections
_project_rooms: dict[str, set[WebSocket]] = defaultdict(set)


async def broadcast_to_project(project_id: str, payload: dict) -> None:
    """Send a JSON message to every connected WebSocket in a project room."""
    stale = set()
    for ws in list(_project_rooms.get(project_id, [])):
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            stale.add(ws)
    _project_rooms[project_id] -= stale


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(default=""),
    project_id: str = Query(default=""),
):
    # Accept first so we can send close frames cleanly
    await ws.accept()

    # Validate JWT from query param
    payload = decode_token(token) if token else None
    if not payload or "sub" not in payload:
        await ws.close(code=4001, reason="Unauthorized")
        return
    if not project_id:
        await ws.close(code=4002, reason="Missing project_id")
        return

    user_id = payload["sub"]
    user_name = payload.get("name") or payload.get("email") or user_id
    user_role = payload.get("role", "viewer")

    # Look up the project owner once so all S3 ops use the correct prefix
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        owner_id = str(project.user_id) if project else user_id

    _project_rooms[project_id].add(ws)

    # Notify others that this user joined
    await broadcast_to_project(project_id, {
        "type": "presence_join",
        "user_id": user_id,
        "name": user_name,
        "role": user_role,
    })

    try:
        while True:
            try:
                raw = await ws.receive_text()
            except RuntimeError:
                # Client disconnected before receive could complete (Starlette
                # raises RuntimeError instead of WebSocketDisconnect in this case)
                break
            data = json.loads(raw)

            if data.get("type") != "chat_message":
                continue

            content = data.get("content", "")
            context = data.get("context", {})
            model = data.get("model")

            print(f"\n{'='*60}")
            print(f"[CHAT] User: {user_id[:8]}... | Project: {project_id[:8]}...")
            print(f"[CHAT] Model: {model or 'default'}")
            print(f"[CHAT] Instruction: {content[:100]}{'...' if len(content) > 100 else ''}")
            if context.get("selected_text"):
                print(f"[CHAT] Selection: {context['selected_text'][:80]}...")
            print(f"{'='*60}")

            # Read current document from S3 using owner's prefix
            latex_content, _ = read_document(owner_id, project_id)
            print(f"[DOC] Loaded main.tex ({len(latex_content)} chars)")

            # Broadcast ai_thinking to all project members
            await broadcast_to_project(project_id, {
                "type": "ai_thinking",
                "user_id": user_id,
                "user_name": user_name,
            })

            # Build initial state
            initial_state: AgentState = {
                "messages": [HumanMessage(content=content)],
                "latex_content": latex_content,
                "user_instruction": content,
                "selected_text": context.get("selected_text"),
                "selection_range": context.get("selection_range"),
                "user_id": owner_id,
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

                final_state = None
                async for event in graph.astream_events(initial_state, config, version="v2"):
                    kind = event.get("event")

                    if kind == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            try:
                                await ws.send_text(json.dumps({
                                    "type": "agent_message_delta",
                                    "content": chunk.content,
                                }))
                            except Exception:
                                return

                    elif kind == "on_chain_start":
                        name = event.get("name", "")
                        if name in ("compile_pdf", "modify_latex", "parse_instruction", "analyze_latex", "answer_question"):
                            print(f"[STREAM] {time.strftime('%H:%M:%S')} | Node: {name}")
                            try:
                                await ws.send_text(json.dumps({
                                    "type": "compile_status",
                                    "status": name,
                                }))
                            except Exception:
                                return

                    elif kind == "on_chain_end":
                        output = event.get("data", {}).get("output")
                        if isinstance(output, dict) and "response_message" in output:
                            final_state = output
                        elif isinstance(output, dict) and "modified_latex" in output:
                            if final_state is None:
                                final_state = dict(initial_state)
                            final_state.update(output)

                if final_state is None:
                    state_snapshot = await graph.aget_state(config)
                    final_state = dict(state_snapshot.values) if state_snapshot else initial_state

                print(f"[DONE] {time.strftime('%H:%M:%S')}")

                response = {
                    "type": "agent_response",
                    "message": final_state.get("response_message", ""),
                    "latex_content": final_state.get("modified_latex") or final_state.get("latex_content"),
                    "diff": final_state.get("diff"),
                    "pdf_url": (final_state.get("compilation_result") or {}).get("pdf_url"),
                    "compilation": final_state.get("compilation_result"),
                }

                try:
                    await ws.send_text(json.dumps(response))
                except Exception:
                    return

                # Notify all project members that AI is done
                await broadcast_to_project(project_id, {
                    "type": "ai_done",
                    "user_id": user_id,
                })

            except WebSocketDisconnect:
                print(f"[WS] Client disconnected during processing")
                return
            except Exception as e:
                traceback.print_exc()
                print(f"[ERROR] {e}")
                try:
                    await ws.send_text(json.dumps({
                        "type": "error",
                        "message": "Something went wrong. Please try again.",
                    }))
                except Exception:
                    return

    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        _project_rooms[project_id].discard(ws)
        # Notify others that user left
        await broadcast_to_project(project_id, {
            "type": "presence_leave",
            "user_id": user_id,
        })
