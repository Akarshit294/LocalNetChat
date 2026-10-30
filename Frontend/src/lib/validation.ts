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

// Same rules as safe_media_type in Backend/realtime/validation.py - keep the two
// in sync. What the server will send as itself rather than as a download, and
// so what this page shows in place: images, video and audio, never SVG (a
// document that can carry scripts). The label is whatever the uploader wrote,
// so it's cleaned first. Null means "offer it as a download only".
export function safeMediaType(contentType: string): string | null {
  const kind = contentType.split(';')[0].trim().toLowerCase();
  if (kind === 'image/svg+xml') {
    return null;
  }
  return /^(image|video|audio)\//.test(kind) ? kind : null;
}

export const FILE_NAME_MAX_LENGTH = 255;
// Same as Validate.FILE_MAX_BYTES. Checked here so a file that's too big is
// turned away before it's uploaded, not after the server has read 50 MB of it.
export const FILE_MAX_BYTES = 50 * 1024 * 1024;

// Same rules as validate_file_name in Backend/realtime/validation.py - keep the
// two in sync. Spaces are fine here: "holiday photo.jpg" is a normal file name.
export function validateFileName(raw: string): string | null {
  const name = raw.trim();
  if (!name) {
    return 'Give the file a name';
  }
  if (Array.from(name).length > FILE_NAME_MAX_LENGTH) {
    return `File name must be at most ${FILE_NAME_MAX_LENGTH} characters`;
  }
  return null;
}
