from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from realtime.manager import ws_manager


router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, username: str = "Anonymous"):
    username = username.strip()
    user_id = await ws_manager.connect(websocket, username)
    if not user_id:
        return
        
    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.send_message(websocket, f"[{username}] {data}")
    except WebSocketDisconnect:
        pass
    finally:
        # runs on a normal leave AND on any error, so a user is never left behind
        await ws_manager.disconnect(user_id)
