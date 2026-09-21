export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 20;

// Same rules as validate_username in Backend/routes/websocket.py - keep the two
// in sync. The backend check is the real one; this one gives instant feedback.
export function validateUsername(raw: string): string | null {
  const name = raw.trim();
  // Array.from counts characters the way Python's len() does (an emoji is 1, not 2)
  const length = Array.from(name).length;
  // asked for first: "alice smith" should hear about the space, not the length
  if (/\s/.test(name)) {
    return "Username can't contain spaces";
  }
  if (length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  }
  if (length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  }
  if (!/[0-9]/.test(name)) {
    return 'Username must contain at least one digit';
  }
  return null;
}

export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 30;

// Same rules as validate_group_name in Backend/realtime/validation.py - keep the
// two in sync. Looser than a username: no digit is needed, and two groups may
// share a name, because a group name labels a chat rather than a person.
export function validateGroupName(raw: string): string | null {
  const name = raw.trim();
  const length = Array.from(name).length;
  if (/\s/.test(name)) {
    return "Group name can't contain spaces";
  }
  if (length < GROUP_NAME_MIN_LENGTH) {
    return "Group name can't be empty";
  }
  if (length > GROUP_NAME_MAX_LENGTH) {
    return `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters`;
  }
  return null;
}
