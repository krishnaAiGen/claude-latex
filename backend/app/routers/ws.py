import json
import traceback

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from langchain_core.messages import HumanMessage

from app.agent.graph import agent_graph
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

            # Read current document from S3
            latex_content, _ = read_document(user_id, project_id)

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
                "parsed_intent": None,
                "modified_latex": None,
                "diff": None,
                "compilation_result": None,
                "response_message": None,
                "retry_count": 0,
            }

            try:
                await ws.send_text(
                    json.dumps({"type": "agent_thinking", "content": "Processing..."})
                )

                async for event in agent_graph.astream_events(
                    initial_state, version="v2"
                ):
                    kind = event.get("event")

                    if kind == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            await ws.send_text(
                                json.dumps(
                                    {
                                        "type": "agent_message_delta",
                                        "content": chunk.content,
                                    }
                                )
                            )

                    elif kind == "on_chain_start":
                        name = event.get("name", "")
                        if name in (
                            "compile_pdf",
                            "modify_latex",
                            "parse_instruction",
                        ):
                            await ws.send_text(
                                json.dumps(
                                    {"type": "compile_status", "status": name}
                                )
                            )

                # Get final state
                final_state = await agent_graph.ainvoke(initial_state)

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

                await ws.send_text(json.dumps(response))

            except Exception as e:
                traceback.print_exc()
                await ws.send_text(
                    json.dumps({"type": "error", "message": str(e)})
                )

    except WebSocketDisconnect:
        pass
