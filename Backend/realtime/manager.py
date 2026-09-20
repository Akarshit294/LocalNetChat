from fastapi import WebSocket
from realtime.types import User, AppState, Event, Command
from realtime.reducer import reduce
from realtime.validation import is_name_taken
import uuid
import asyncio
from datetime import datetime


class WebSocketManager:
    def __init__(self):
        self.state = AppState()
        self.sockets = {}
        self._lock = asyncio.Lock()

    async def dispatch(self, event: Event):
        async with self._lock:
            self.state, commands = reduce(self.state, event)
            for command in commands:
                await self.run(command)

    async def run(self, command: Command):
        if command.type == "close":
            websocket = self.sockets.pop(command.user_id, None)
            if websocket:
                await websocket.close(code=command.code, reason=command.reason)
        elif command.type == "broadcast":
            for user_id, websocket in list(self.sockets.items()):
                try:
                    await websocket.send_json(command.message)
                except Exception:
                    print(f"Failed to send broadcast to {user_id}, dropping the socket")
                    self.sockets.pop(user_id, None)

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()

        user_id = uuid.uuid4()
        user = User(id=user_id, user_name=username, joined_at=datetime.now())

        self.sockets[user_id] = websocket

        await self.dispatch(Event(type="join_requested", user=user))

        if user_id in self.state.users:
            return user_id
        return None

    async def disconnect(self, user_id: uuid.UUID):
        if user_id in self.sockets:
            del self.sockets[user_id]
            await self.dispatch(Event(type="user_left", user_id=user_id))

    def verify_username(self, username: str):
        return not is_name_taken(self.state, username)


ws_manager = WebSocketManager()
