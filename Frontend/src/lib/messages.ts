// The messages the server sends us.
// Mirrors Backend/realtime/messages.py - keep the two in sync.

export type ChatUser = {
  id: string;
  user_name: string;
};

export type UsersMessage = {
  type: 'users';
  users: ChatUser[];
};

export type SystemMessage = {
  type: 'system';
  text: string;
};

export type ServerMessage = UsersMessage | SystemMessage;
