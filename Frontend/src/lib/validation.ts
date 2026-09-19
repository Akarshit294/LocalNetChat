export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 20;

// Same rules as validate_username in Backend/routes/websocket.py - keep the two
// in sync. The backend check is the real one; this one gives instant feedback.
export function validateUsername(raw: string): string | null {
  const name = raw.trim();
  // Array.from counts characters the way Python's len() does (an emoji is 1, not 2)
  const length = Array.from(name).length;
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
