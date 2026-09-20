import re
from realtime.types import AppState, Validate


# Same rules as Frontend/src/lib/validation.ts - keep the two in sync.
def validate_username(username: str) -> str | None:
    """Return why the username breaks the rules, or None if it's valid."""
    if len(username) < Validate.USERNAME_MIN_LENGTH:
        return f"Username must be at least {Validate.USERNAME_MIN_LENGTH} characters"
    if len(username) > Validate.USERNAME_MAX_LENGTH:
        return f"Username must be at most {Validate.USERNAME_MAX_LENGTH} characters"
    if not re.search(r"[0-9]", username):
        return "Username must contain at least one digit"
    return None


def is_name_taken(state: AppState, username: str) -> bool:
    """Is someone already using this name? Pure - it only reads the state it's given."""
    # casefold() ignores case, so Riya1 and riya1 count as the same name
    return any(
        user.user_name.casefold() == username.casefold()
        for user in state.users.values()
    )