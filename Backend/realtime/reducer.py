from realtime.messages import error_message, system_message, users_message
from realtime.types import AppState, Command, Event
from realtime.validation import is_name_taken, validate_username


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

            new_state = AppState(users={**state.users, event.payload["user"].id: event.payload["user"]})
            return new_state, [
                Command(type="broadcast", message=users_message(new_state)),
                Command(
                    type="broadcast",
                    message=system_message(f"{event.payload['user'].user_name} has joined the chat"),
                ),
            ]
    elif event_type == "user_left":
        user_id = event.payload.get("user_id")
        if user_id and user_id in state.users:
            users = {uid: user for uid, user in state.users.items() if uid != user_id}
            new_state = AppState(users=users)
            who_left = state.users[user_id].user_name
            return new_state, [
                Command(type="broadcast", message=users_message(new_state)),
                Command(type="broadcast", message=system_message(f"{who_left} has left the chat")),
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
            users = {**state.users, user_id: updated_user}
            new_state = AppState(users=users)
            return new_state, [
                Command(type="send", user_id=user_id, message={"type": "renamed", "new_name": new_name}),
                Command(type="broadcast", message=users_message(new_state)),
                Command(type="broadcast", message=system_message(f"{old_name} has changed their name to {new_name}")),
            ]

    # nothing to change: hand back the state we were given
    return state, []
