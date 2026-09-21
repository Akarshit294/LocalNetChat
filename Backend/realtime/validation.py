import re
import uuid
from realtime.types import AppState, Validate


# Same rules as Frontend/src/lib/validation.ts - keep the two in sync.
def validate_username(username: str) -> str | None:
    """Return why the username breaks the rules, or None if it's valid."""
    username = username.strip()
    # asked for first: "alice smith" should hear about the space, not the length
    if re.search(r"\s", username):
        return "Username can't contain spaces"
    if len(username) < Validate.USERNAME_MIN_LENGTH:
        return f"Username must be at least {Validate.USERNAME_MIN_LENGTH} characters"
    if len(username) > Validate.USERNAME_MAX_LENGTH:
        return f"Username must be at most {Validate.USERNAME_MAX_LENGTH} characters"
    if not re.search(r"[0-9]", username):
        return "Username must contain at least one digit"
    return None


def is_name_taken(state: AppState, username: str, ignore_user_id: uuid.UUID | None = None) -> bool:
    """Is someone already using this name? Pure - it only reads the state it's given.

    ignore_user_id skips one person, so renaming yourself from riya1 to Riya1
    isn't refused as taken by you.
    """
    # casefold() ignores case, so Riya1 and riya1 count as the same name
    return any(
        user.user_name.casefold() == username.casefold()
        for user_id, user in state.users.items()
        if user_id != ignore_user_id
    )


# Same rules as validateGroupName in Frontend/src/lib/validation.ts - keep the two in sync.
def validate_group_name(name: str) -> str | None:
    """Return why the group name breaks the rules, or None if it's valid.

    Looser than a username: no digit is needed, and two groups may share a name.
    A group name labels a conversation; it isn't an identity anyone is addressed by.
    """
    trimmed = name.strip()
    if re.search(r"\s", trimmed):
        return "Group name can't contain spaces"
    if len(trimmed) < Validate.GROUP_NAME_MIN_LENGTH:
        return "Group name can't be empty"
    if len(trimmed) > Validate.GROUP_NAME_MAX_LENGTH:
        return f"Group name must be at most {Validate.GROUP_NAME_MAX_LENGTH} characters"
    return None
