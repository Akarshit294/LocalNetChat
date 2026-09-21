import uuid
from datetime import datetime

from realtime.types import AppState, Chat


def active_users(state: AppState):
    """Who is online, as plain data. Pure - it only reads the state it is given."""
    return [
        {"id": str(user_id), "user_name": user.user_name}
        for user_id, user in state.users.items()
    ]


def users_message(state: AppState):
    """The online list, ready to send. The type sits on the envelope, once."""
    return {"type": "users", "users": active_users(state)}


def system_message(text: str):
    """A line for the page to show, such as "riya1 has joined the chat"."""
    return {"type": "system", "text": text}


def welcome_message(user):
    """Sent only to the person who just joined: this is who you are."""
    return {"type": "welcome", "user_id": str(user.id), "user_name": user.user_name}


def error_message(reason: str):
    """Something the sender asked for can't be done. Their connection stays open."""
    return {"type": "error", "reason": reason}


def display_name(state: AppState, user_id: uuid.UUID):
    """Their name if they're here, the last name we knew if they've gone."""
    user = state.users.get(user_id)
    if user:
        return user.user_name
    return state.known_names.get(user_id, "someone")


def chat_summary(state: AppState, chat: Chat):
    """One chat, with each member's name and whether they're still connected."""
    return {
        "id": str(chat.id),
        "type": chat.type,
        "name": chat.name,
        "members": [
            {
                "id": str(member_id),
                "user_name": display_name(state, member_id),
                "online": member_id in state.users,
            }
            for member_id in chat.members
        ],
    }


def chats_message(state: AppState, user_id: uuid.UUID):
    """The chats this one person is in. Personal, so it's sent, never broadcast."""
    return {
        "type": "chats",
        "chats": [
            chat_summary(state, chat)
            for chat in state.chats.values()
            if user_id in chat.members
        ],
    }


def chat_opened_message(chat_id: uuid.UUID):
    """Only for the person who asked, so their page can open that chat."""
    return {"type": "chat_opened", "chat_id": str(chat_id)}


def chat_message(chat_id: uuid.UUID, from_id: uuid.UUID, text: str, sent_at: datetime):
    """Someone said something. Relayed, never stored."""
    return {
        "type": "message",
        "chat_id": str(chat_id),
        "from_id": str(from_id),
        "text": text,
        "sent_at": sent_at.isoformat(),
    }
