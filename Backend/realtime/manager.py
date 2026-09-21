from fastapi import WebSocket
from pydantic import ValidationError
from realtime.messages import error_message
from realtime.types import (
    User,
    AppState,
    Event,
    Command,
    AddMemberMessage,
    CreateGroupMessage,
    OpenChatMessage,
    RemoveMemberMessage,
    RenameMessage,
    SendMessage,
)
from realtime.reducer import reduce
from realtime.validation import is_name_taken
import uuid
import asyncio
from datetime import datetime

# every message type a client may send, and the model that checks its shape
INCOMING_MESSAGES = {
    "rename": RenameMessage,
    "open_chat": OpenChatMessage,
    "send_message": SendMessage,
    "create_group": CreateGroupMessage,
    "add_member": AddMemberMessage,
    "remove_member": RemoveMemberMessage,
}


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
        elif command.type == "send":
            websocket = self.sockets.get(command.user_id)
            if websocket:
                try:
                    await websocket.send_json(command.message)
                except Exception:
                    print(f"Failed to send message to {command.user_id}, dropping the socket")
                    self.sockets.pop(command.user_id, None)

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()

        user_id = uuid.uuid4()
        user = User(id=user_id, user_name=username, joined_at=datetime.now())

        self.sockets[user_id] = websocket

        await self.dispatch(Event(type="join_requested", payload={"user": user}))

        if user_id in self.state.users:
            return user_id
        return None

    async def disconnect(self, user_id: uuid.UUID):
        if user_id in self.sockets:
            del self.sockets[user_id]
            await self.dispatch(Event(type="user_left", payload={"user_id": user_id}))

    def verify_username(self, username: str):
        return not is_name_taken(self.state, username)

    async def handle_message(self, user_id: uuid.UUID, message):
        # who sent it is decided by the socket it arrived on, never by the message
        if user_id not in self.state.users:
            return

        message_type = message.get("type") if isinstance(message, dict) else None
        model = INCOMING_MESSAGES.get(message_type)
        if model is None:
            await self.send_error(user_id, f"Unknown message type: {message_type}")
            return

        try:
            checked = model.model_validate(message)
        except ValidationError as error:
            print(f"Bad {message_type} message from {user_id}: {error}")
            await self.send_error(user_id, f"That {message_type} message was the wrong shape")
            return

        # the reducer is pure, so anything random or clock-based is made here
        if isinstance(checked, RenameMessage):
            await self.dispatch(
                Event(type="rename_requested", payload={"user_id": user_id, "new_name": checked.user_name.strip()})
            )
        elif isinstance(checked, OpenChatMessage):
            await self.dispatch(
                Event(type="open_chat_requested", payload={
                    "user_id": user_id,
                    "other_id": checked.user_id,
                    "new_chat_id": uuid.uuid4(),   # used only if there's no chat yet
                })
            )
        elif isinstance(checked, SendMessage):
            await self.dispatch(
                Event(type="message_sent", payload={
                    "user_id": user_id,
                    "chat_id": checked.chat_id,
                    "text": checked.text,
                    "sent_at": datetime.now(),
                })
            )
        elif isinstance(checked, CreateGroupMessage):
            await self.dispatch(
                Event(type="create_group_requested", payload={
                    "user_id": user_id,
                    "member_ids": checked.user_ids,
                    "name": checked.name,
                    "new_chat_id": uuid.uuid4(),
                })
            )
        elif isinstance(checked, AddMemberMessage):
            await self.dispatch(
                Event(type="add_member_requested", payload={
                    "user_id": user_id,
                    "chat_id": checked.chat_id,
                    "new_member_id": checked.user_id,
                })
            )
        elif isinstance(checked, RemoveMemberMessage):
            await self.dispatch(
                Event(type="remove_member_requested", payload={
                    "user_id": user_id,
                    "chat_id": checked.chat_id,
                    "leaving_id": checked.user_id,
                })
            )

    async def send_error(self, user_id: uuid.UUID, reason: str):
        # a message we couldn't even read never becomes an event, so answer it here
        await self.run(Command(type="send", user_id=user_id, message=error_message(reason)))


ws_manager = WebSocketManager()
