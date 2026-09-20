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
            # incoming messages get their own types in the next block.
            # reading keeps the connection alive and tells us when they leave.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(user_id)
