import type { ChatSummary } from './messages.ts';

// A private chat has no name of its own, so it is named after the other people
// in it. Unlike the app's version this leaves "(disconnected)" out of the
// title: who is here is drawn, not spelled.
export function chatTitle(chat: ChatSummary, myId: string): string {
  if (chat.name) {
    return chat.name;
  }
  return others(chat, myId)
    .map((member) => member.user_name)
    .join(', ');
}

export function others(chat: ChatSummary, myId: string) {
  return chat.members.filter((member) => member.id !== myId);
}

export function canWrite(chat: ChatSummary, myId: string) {
  // with nobody else connected there's nowhere for a message to go
  return chat.members.some((member) => member.id !== myId && member.online);
}

// "3 people · 2 here" for a group, "disconnected" for a private chat that has
// gone quiet. Only ever counts, never invented detail.
export function chatMeta(chat: ChatSummary, myId: string): string {
  const rest = others(chat, myId);
  if (chat.type === 'group') {
    const here = chat.members.filter((member) => member.online).length;
    // the count everyone wants is how many are in it; "who is missing" only
    // earns its place when somebody is
    return here === chat.members.length
      ? `${chat.members.length} people`
      : `${chat.members.length} people · ${here} here`;
  }
  return rest.every((member) => member.online) ? 'private' : 'private · disconnected';
}

export function clockOf(sentAt: string): string {
  const at = new Date(sentAt);
  if (Number.isNaN(at.getTime())) {
    return '';
  }
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
