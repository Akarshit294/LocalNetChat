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

// sent only to us, when we join: this is who you are
export type WelcomeMessage = {
  type: 'welcome';
  user_id: string;
  user_name: string;
};

export type RenamedMessage = {
  type: 'renamed';
  new_name: string;
};

export type ErrorMessage = {
  type: 'error';
  reason: string;
};

// a chat member, as the server describes them: their name, and whether they're still here
export type ChatMember = {
  id: string;
  user_name: string;
  online: boolean;
};

export type ChatSummary = {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  members: ChatMember[];
};

// our own chats. Personal, so it's sent only to us
export type ChatsMessage = {
  type: 'chats';
  chats: ChatSummary[];
};

// the server made or found the chat we asked for
export type ChatOpenedMessage = {
  type: 'chat_opened';
  chat_id: string;
};

export type ChatTextMessage = {
  type: 'message';
  chat_id: string;
  from_id: string;
  text: string;
  sent_at: string;
};

export type ServerMessage =
  | UsersMessage
  | SystemMessage
  | WelcomeMessage
  | RenamedMessage
  | ErrorMessage
  | ChatsMessage
  | ChatOpenedMessage
  | ChatTextMessage;

// What we send to the server.

export type RenameMessage = {
  type: 'rename';
  user_name: string;
};

export type OpenChatMessage = {
  type: 'open_chat';
  user_id: string;
};

export type SendMessageMessage = {
  type: 'send_message';
  chat_id: string;
  text: string;
};

// make a group with these people. We are not in the list: the server adds
// whoever sent it, from the socket it arrived on.
export type CreateGroupMessage = {
  type: 'create_group';
  user_ids: string[];
  name: string;
};

// changing who is in a group. One person per message, so two pages editing at
// once can't undo each other the way a whole-list update would.
export type AddMemberMessage = {
  type: 'add_member';
  chat_id: string;
  user_id: string;
};

// our own id here means we're leaving
export type RemoveMemberMessage = {
  type: 'remove_member';
  chat_id: string;
  user_id: string;
};

export type ClientMessage =
  | RenameMessage
  | OpenChatMessage
  | SendMessageMessage
  | CreateGroupMessage
  | AddMemberMessage
  | RemoveMemberMessage;
