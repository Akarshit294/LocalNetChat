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
        # one event at a time, start to finish, so two events can't interleave
        async with self._lock:
            self.state, commands = reduce(self.state, event)
            for command in commands:
                await self.run(command)

    async def run(self, command: Command):
        # the effect runtime: the only place that touches a socket
        if command.type == "close":
            websocket = self.sockets.pop(command.user_id, None)
            if websocket:
                await websocket.close(code=command.code, reason=command.reason)

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()

        user_id = uuid.uuid4()
        user = User(id=user_id, user_name=username, joined_at=datetime.now())

        # the socket is reachable from now on, so a refusal can be delivered through it
        self.sockets[user_id] = websocket

        await self.dispatch(Event(type="join_requested", user=user))

        # the reducer decides. If it refused, its close command has already run.
        if user_id in self.state.users:
            return user_id
        return None

    async def disconnect(self, user_id: uuid.UUID):
        if user_id in self.sockets:
            del self.sockets[user_id]
            await self.dispatch(Event(type="user_left", user_id=user_id))

    async def send_message(self, websocket: WebSocket, message: str):
        await websocket.send_text(message)

    def verify_username(self, username: str):
        # a read, so it needs no event: only writes go through dispatch
        return not is_name_taken(self.state, username)

    def get_users(self):
        return [
            {"id": str(user_id), "user_name": user.user_name}
            for user_id, user in self.state.users.items()
        ]


ws_manager = WebSocketManager()
