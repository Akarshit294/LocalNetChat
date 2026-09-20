from realtime.types import AppState


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


def error_message(reason: str):
    """Something the sender asked for can't be done. Their connection stays open."""
    return {"type": "error", "reason": reason}
