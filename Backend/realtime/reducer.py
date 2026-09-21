from realtime.messages import (
    chat_message,
    chat_opened_message,
    chats_message,
    error_message,
    system_message,
    users_message,
    welcome_message,
)
from realtime.types import AppState, Chat, Command, Event
from realtime.validation import is_name_taken, validate_username


def chats_commands(state: AppState, user_ids):
    """Send each of these people their own chat list, skipping anyone who has gone."""
    return [
        Command(type="send", user_id=user_id, message=chats_message(state, user_id))
        for user_id in user_ids
        if user_id in state.users
    ]


def chat_mates(state: AppState, user_id):
    """Everyone who shares a chat with this person, plus the person themselves."""
    mates = {user_id}
    for chat in state.chats.values():
        if user_id in chat.members:
            mates.update(chat.members)
    return mates


def find_private_chat(state: AppState, first_id, second_id):
    """The private chat these two already have, if there is one."""
    pair = {first_id, second_id}
    for chat in state.chats.values():
        if chat.type == "private" and set(chat.members) == pair:
            return chat
    return None


def reduce(state: AppState, event: Event):
    """Work out the new state and what should be done about it.

    Pure: it only reads what it is given, never sends or closes anything, and
    returns a new state plus a list of commands for the manager to carry out.
    """
    event_type = event.type
    if event_type == "join_requested":
        if event.payload.get("user"):
            error = validate_username(event.payload["user"].user_name)
            if error:
                return state, [
                    Command(
                        type="close",
                        user_id=event.payload["user"].id,
                        code=4002,
                        reason=error
                    )
                ]

            if is_name_taken(state, event.payload["user"].user_name):
                return state, [
                    Command(
                        type="close",
                        user_id=event.payload["user"].id,
                        code=4001,
                        reason="Username already taken"
                    )
                ]

            user = event.payload["user"]
            new_state = state.model_copy(update={
                "users": {**state.users, user.id: user},
                "known_names": {**state.known_names, user.id: user.user_name},
            })
            return new_state, [
                # the greeting goes first, so they know who they are before the list arrives
                Command(
                    type="send",
                    user_id=user.id,
                    message=welcome_message(user)
                ),
                Command(
                    type="broadcast",
                    message=users_message(new_state)
                ),
                Command(
                    type="broadcast",
                    message=system_message(f"{user.user_name} has joined the chat"),
                ),
            ]
    elif event_type == "user_left":
        user_id = event.payload.get("user_id")
        if user_id and user_id in state.users:
            users = {uid: user for uid, user in state.users.items() if uid != user_id}
            # their chats stay, so the other side keeps the conversation and sees
            # them as offline. A chat nobody is left online in is dropped.
            chats = {
                chat_id: chat
                for chat_id, chat in state.chats.items()
                if any(member_id in users for member_id in chat.members)
            }
            # keep the names only of people still named in a chat
            still_named = {member_id for chat in chats.values() for member_id in chat.members}
            known_names = {
                uid: name
                for uid, name in state.known_names.items()
                if uid in users or uid in still_named
            }
            new_state = state.model_copy(update={
                "users": users,
                "chats": chats,
                "known_names": known_names,
            })
            who_left = state.users[user_id].user_name
            return new_state, [
                Command(
                    type="broadcast",
                    message=users_message(new_state)
                ),
                Command(
                    type="broadcast",
                    message=system_message(f"{who_left} has left the chat")
                ),
                # everyone who shared a chat with them sees them go offline
                *chats_commands(new_state, chat_mates(state, user_id)),
            ]

    elif event_type == "rename_requested":
        user_id = event.payload.get("user_id")
        new_name = event.payload.get("new_name")
        if user_id and new_name and user_id in state.users:
            error = validate_username(new_name)
            if error:
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message(error)
                    )
                ]

            if is_name_taken(state, new_name, ignore_user_id=user_id):
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message("Username already taken")
                    )
                ]

            old_name = state.users[user_id].user_name
            updated_user = state.users[user_id].model_copy(update={"user_name": new_name})
            new_state = state.model_copy(update={
                "users": {**state.users, user_id: updated_user},
                "known_names": {**state.known_names, user_id: new_name},
            })
            return new_state, [
                Command(
                    type="send",
                    user_id=user_id,
                    message={"type": "renamed", "new_name": new_name}
                ),
                Command(
                    type="broadcast",
                    message=users_message(new_state)
                ),
                Command(
                    type="broadcast",
                    message=system_message(f"{old_name} has changed their name to {new_name}")
                ),
                # their chats show the new name too
                *chats_commands(new_state, chat_mates(new_state, user_id)),
            ]

    elif event_type == "open_chat_requested":
        user_id = event.payload.get("user_id")
        other_id = event.payload.get("other_id")
        new_chat_id = event.payload.get("new_chat_id")
        if user_id and other_id and user_id in state.users:
            if other_id == user_id:
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message("You can't chat with yourself")
                    )
                ]

            if other_id not in state.users:
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message("They are not here any more")
                    )
                ]

            existing = find_private_chat(state, user_id, other_id)
            if existing:
                # both clicking Message lands in the same chat
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=chat_opened_message(existing.id)
                    )
                ]

            chat = Chat(id=new_chat_id, type="private", members=[user_id, other_id])
            new_state = state.model_copy(update={"chats": {**state.chats, chat.id: chat}})
            return new_state, [
                Command(
                    type="send",
                    user_id=user_id,
                    message=chat_opened_message(chat.id)
                ),
                *chats_commands(new_state, chat.members),
            ]

    elif event_type == "message_sent":
        user_id = event.payload.get("user_id")
        chat_id = event.payload.get("chat_id")
        text = event.payload.get("text")
        sent_at = event.payload.get("sent_at")
        if user_id and chat_id and text and user_id in state.users:
            chat = state.chats.get(chat_id)
            if not chat or user_id not in chat.members:
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message("That chat isn't yours")
                    )
                ]

            others_online = [
                member_id
                for member_id in chat.members
                if member_id != user_id and member_id in state.users
            ]
            if not others_online:
                return state, [
                    Command(
                        type="send",
                        user_id=user_id,
                        message=error_message("Nobody in this chat is online")
                    )
                ]

            # relayed, never stored: whoever is connected gets it, including the sender
            return state, [
                Command(
                    type="send",
                    user_id=member_id,
                    message=chat_message(chat.id, user_id, text, sent_at)
                )
                for member_id in chat.members
                if member_id in state.users
            ]

    # nothing to change: hand back the state we were given
    return state, []
