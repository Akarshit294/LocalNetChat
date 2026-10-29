import re
import uuid
import secrets
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


# Same rules as validateFileName in Frontend/src/lib/validation.ts - keep the two in sync.
def validate_file_name(name: str) -> str | None:
    """Return why the file name breaks the rules, or None if it's valid.

    Spaces are fine: "holiday photo.jpg" is a normal file name. The name is only
    stored and shown, never used as a path on disk, so "../" in it does no harm.
    """
    trimmed = name.strip()
    if not trimmed:
        return "Give the file a name"
    if len(trimmed) > Validate.FILE_NAME_MAX_LENGTH:
        return f"File name must be at most {Validate.FILE_NAME_MAX_LENGTH} characters"
    return None


def user_for_token(state, token: str | None) -> uuid.UUID | None:
    """Return the user_id for this token, or None if it's not valid."""
    if not token:
        return None
    for user_id, user in state.users.items():
        if secrets.compare_digest(user.token.encode(), token.encode()):
            return user_id
    return None