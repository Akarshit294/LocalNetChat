import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie
from realtime.manager import ws_manager
from routes.guards import same_origin


router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session: str | None = Cookie(default=None)):
    # A page on another site can open a socket here too, and the browser would
    # attach our cookie to it: CORS doesn't cover WebSockets. Only our own page
    # gets in. Refused before accepting, so the handshake itself fails (403).
    if not same_origin(websocket.headers.get("origin"), websocket.headers.get("host")):
        await websocket.close(code=1008, reason="Cross-origin WebSocket not allowed")
        return

    # whether the session is real is a rule, so the reducer decides, and a page
    # without one is told why (4003 "Join first") rather than just cut off
    user_id = await ws_manager.connect(websocket, session or "")
    if not user_id:
        return
        
    try:
        while True:
            # incoming messages get their own types in the next block.
            # reading keeps the connection alive and tells us when they leave.
            try:
                msg = await websocket.receive_json()
            except (json.JSONDecodeError, KeyError):
                continue
            await ws_manager.handle_message(user_id, msg)
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(user_id)
