from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import re
import uuid

router = APIRouter()

USERNAME_MIN_LENGTH = 4
USERNAME_MAX_LENGTH = 20

# Same rules as Frontend/src/lib/validation.ts - keep the two in sync.
def validate_username(username: str) -> str | None:
    """Return why the username breaks the rules, or None if it's valid."""
    if len(username) < USERNAME_MIN_LENGTH:
        return f"Username must be at least {USERNAME_MIN_LENGTH} characters"
    if len(username) > USERNAME_MAX_LENGTH:
        return f"Username must be at most {USERNAME_MAX_LENGTH} characters"
    if not re.search(r"[0-9]", username):
        return "Username must contain at least one digit"
    return None

class WebSocketManager:
    def __init__(self):
        # active_connections is a dictionary that maps user_id to a list containing username and websocket
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()

        error = validate_username(username)
        if error:
            await websocket.close(code=4002, reason=error)
            return False
        if not await self.verify_username(username):
            await websocket.close(code=4001, reason="Username already taken")
            return False

        user_id = uuid.uuid4()
        self.active_connections[user_id] = [username, websocket]
        print(f"User {username} connected with ID {user_id}. Total connections: {len(self.active_connections)}")
        return True

    async def disconnect(self, websocket: WebSocket):
        for user_id, (username, ws) in list(self.active_connections.items()):
            if ws == websocket:
                del self.active_connections[user_id]
                print(f"User {username} disconnected. Total connections: {len(self.active_connections)}")
                break

    async def send_message(self, websocket: WebSocket, message: str):
        await websocket.send_text(message)

    async def verify_username(self, username: str):
        # casefold() ignores case, so Riya1 and riya1 count as the same name
        for user_id, (existing_username, ws) in self.active_connections.items():
            if existing_username.casefold() == username.casefold():
                return False
        return True

ws_manager = WebSocketManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, username: str = "Anonymous"):
    username = username.strip()
    connected = await ws_manager.connect(websocket, username)
    if not connected:
        return
        
    try:
        while True:
            data = await websocket.receive_text()
            await ws_manager.send_message(websocket, f"[{username}] {data}")
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)


@router.get("/verify_username")
async def verify_username_endpoint(username: str):
    username = username.strip()
    is_available = await ws_manager.verify_username(username)
    return {"available": is_available}