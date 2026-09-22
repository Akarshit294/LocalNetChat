// A LocalNetChat server, in the browser, so the whole UI can be looked at
// without starting anything.
//
// It mirrors Backend/realtime/reducer.py: the same rules, the same refusals in
// the same words, the same messages on the wire. Nothing here is meant to be
// copied into the app — it exists so the pages next to it can be.
//
// What it does that the real one doesn't: it also plays everyone else. People
// come and go, and somebody answers when you talk to them.

import { tileOf } from '../lib/animals.ts';
import { DEMO_OPEN, NOTICE } from '../lib/mode.ts';
import type {
  ChatSummary,
  ChatUser,
  ClientMessage,
  ServerMessage,
} from '../lib/messages.ts';
import { validateGroupName, validateUsername } from '../lib/validation.ts';

type Person = {
  id: string;
  user_name: string;
  online: boolean;
  bot: boolean;
};

type Chat = {
  id: string;
  type: 'private' | 'group';
  name: string | null;
  members: string[];
};

export type Wire = {
  onMessage: (message: ServerMessage) => void;
  onClose: (reason: string) => void;
};

// Usernames here obey the app's own rule: 4-20 characters, at least one digit.
const ROSTER = [
  'meera3', 'dev77', 'riya1', 'sam42', 'nikhil9',
  'tara5', 'ishan2', 'priya8', 'arjun4', 'zoya6',
];
const START_ONLINE = 5;

// what someone says back. Short, because everyone is in the next room.
const REPLIES = [
  'on it',
  'two minutes',
  'ha',
  'where are you sitting?',
  'ok',
  'i can hear you typing',
  'the router blinked again',
  'coming down',
  'send it here',
  'yes',
  'no idea, ask meera3',
  'that was me',
];

const OPENERS = [
  'you around?',
  'did you print it?',
  'wifi ok on your side?',
  'come to the kitchen',
];

const CHURN_MS = 15_000;
const FIRST_DM_MS = 18_000;

let counter = 0;
function newId(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

class MockNet {
  private people = new Map<string, Person>();
  private chats = new Map<string, Chat>();
  private timers = new Set<number>();
  private wire: Wire | null = null;
  // what was said before anyone was listening. The lab's ?as= joins before
  // React's first render, so the page starts out already connected and no page
  // ever bounces to the join screen on its way in.
  private pending: ServerMessage[] = [];
  private meId = '';
  // which animals are spoken for. Hashing an id on its own gives two people in
  // the same room the same face often enough to look like a bug — the server
  // knows everyone, so it is the thing that should hand them out without
  // replacement. Here that means choosing ids whose tiles are still free.
  private takenTiles = new Set<number>();

  constructor() {
    this.seed();
  }

  // everyone who was already here when you opened the page
  private seed() {
    this.people.clear();
    this.chats.clear();
    this.takenTiles.clear();
    ROSTER.forEach((name, i) => {
      const person: Person = {
        id: this.freeId(`bot-${name}`),
        user_name: name,
        online: i < START_ONLINE,
        bot: true,
      };
      this.people.set(person.id, person);
    });
  }

  // an id whose animal nobody else has yet
  private freeId(base: string) {
    let id = base;
    let attempt = 2;
    while (this.takenTiles.has(tileOf(id))) {
      id = `${base}-${attempt}`;
      attempt += 1;
    }
    this.takenTiles.add(tileOf(id));
    return id;
  }

  // ---------------------------------------------------------------- reading

  private online() {
    return [...this.people.values()].filter((person) => person.online);
  }

  private me() {
    return this.people.get(this.meId);
  }

  // GET /users/check, which doesn't know who's asking and so reports your own
  // name as taken — exactly like the real endpoint.
  isNameFree(name: string) {
    const wanted = name.trim().toLowerCase();
    return !this.online().some((person) => person.user_name.toLowerCase() === wanted);
  }

  private summary(chat: Chat): ChatSummary {
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      members: chat.members.map((id) => {
        const person = this.people.get(id);
        return {
          id,
          user_name: person ? person.user_name : 'someone',
          online: person ? person.online : false,
        };
      }),
    };
  }

  // ---------------------------------------------------------------- sending

  private emit(message: ServerMessage) {
    if (this.wire) {
      this.wire.onMessage(message);
    } else {
      this.pending.push(message);
    }
  }

  private sendUsers() {
    const users: ChatUser[] = this.online().map((person) => ({
      id: person.id,
      user_name: person.user_name,
    }));
    this.emit({ type: 'users', users });
  }

  private sendSystem(text: string) {
    this.emit({ type: 'system', text });
  }

  // `chats` is personal, so only ours is ever on the wire here
  private sendChats() {
    const mine = [...this.chats.values()].filter((chat) => chat.members.includes(this.meId));
    this.emit({ type: 'chats', chats: mine.map((chat) => this.summary(chat)) });
  }

  private sendError(reason: string) {
    this.emit({ type: 'error', reason });
  }

  private later(run: () => void, ms: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      run();
    }, ms);
    this.timers.add(timer);
  }

  private every(run: () => void, ms: number) {
    const timer = window.setInterval(run, ms);
    this.timers.add(timer);
  }

  private stopTimers() {
    for (const timer of this.timers) {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    }
    this.timers.clear();
  }

  // ------------------------------------------------------------ connecting

  // joins, or says why not. The page checks these rules too, but the server is
  // the real check: a refused join closes with 4002 for a broken rule, 4001 for
  // a name already taken.
  private startSession(name: string): string | null {
    const wanted = name.trim();

    const broken = validateUsername(wanted);
    if (broken) {
      return broken;
    }
    if (!this.isNameFree(wanted)) {
      return 'Username already taken';
    }

    this.meId = this.freeId(newId('me'));
    this.people.set(this.meId, { id: this.meId, user_name: wanted, online: true, bot: false });

    this.emit({ type: 'welcome', user_id: this.meId, user_name: wanted });
    this.sendUsers();
    this.sendChats();
    this.sendSystem(`${wanted} has joined the chat`);
    this.startAmbience();
    if (NOTICE) {
      this.later(() => this.sendError(NOTICE), 400);
    }
    return null;
  }

  connect(name: string, wire: Wire) {
    this.wire = wire;
    const refused = this.startSession(name);
    if (refused) {
      wire.onClose(refused);
    }
  }

  // Lab only. Joins with nobody listening and hands back everything the server
  // would have said, so the provider can start from it instead of connecting
  // after its first render and making every page bounce.
  bootstrap(name: string, demo: boolean): ServerMessage[] {
    this.wire = null;
    this.pending = [];
    if (this.startSession(name)) {
      return [];
    }
    if (demo) {
      this.demo();
    }
    return this.pending.splice(0);
  }

  // whatever the ambience said in the meantime goes to the page at once
  attach(wire: Wire) {
    this.wire = wire;
    const waiting = this.pending.splice(0);
    for (const message of waiting) {
      wire.onMessage(message);
    }
  }

  disconnect() {
    this.stopTimers();
    if (this.me()) {
      this.takenTiles.delete(tileOf(this.meId));
      this.people.delete(this.meId);
    }
    // a chat is dropped once nobody in it is online, and we were the only one
    for (const [id, chat] of [...this.chats]) {
      if (chat.members.includes(this.meId)) {
        this.chats.delete(id);
      }
    }
    this.meId = '';
    this.wire?.onClose('');
    this.wire = null;
  }

  // ------------------------------------------------------------- receiving

  send(message: ClientMessage) {
    if (!this.meId) {
      return;
    }
    switch (message.type) {
      case 'rename':
        this.rename(message.user_name);
        break;
      case 'open_chat':
        this.openChat(message.user_id);
        break;
      case 'send_message':
        this.sendMessage(message.chat_id, message.text);
        break;
      case 'create_group':
        this.createGroup(message.user_ids, message.name);
        break;
      case 'add_member':
        this.addMember(message.chat_id, message.user_id);
        break;
      case 'remove_member':
        this.removeMember(message.chat_id, message.user_id);
        break;
    }
  }

  private rename(raw: string) {
    const me = this.me();
    if (!me) {
      return;
    }
    const wanted = raw.trim();
    const broken = validateUsername(wanted);
    if (broken) {
      this.sendError(broken);
      return;
    }
    // unique ignoring case, and the check skips you, so riya1 -> Riya1 is fine
    const taken = this.online().some(
      (person) => person.id !== me.id && person.user_name.toLowerCase() === wanted.toLowerCase(),
    );
    if (taken) {
      this.sendError('Username already taken');
      return;
    }
    const old = me.user_name;
    me.user_name = wanted;
    this.emit({ type: 'renamed', new_name: wanted });
    this.sendUsers();
    this.sendChats();
    this.sendSystem(`${old} has changed their name to ${wanted}`);
  }

  private openChat(userId: string) {
    if (userId === this.meId) {
      this.sendError("You can't chat with yourself");
      return;
    }
    const them = this.people.get(userId);
    if (!them || !them.online) {
      this.sendError('They are not here any more');
      return;
    }
    // there is only one sensible private conversation between two people, so
    // this reuses one if it exists
    const existing = [...this.chats.values()].find(
      (chat) =>
        chat.type === 'private' &&
        chat.members.length === 2 &&
        chat.members.includes(this.meId) &&
        chat.members.includes(userId),
    );
    const chat: Chat =
      existing ?? {
        id: newId('chat'),
        type: 'private',
        name: null,
        members: [this.meId, userId],
      };
    this.chats.set(chat.id, chat);
    this.sendChats();
    this.emit({ type: 'chat_opened', chat_id: chat.id });
  }

  private sendMessage(chatId: string, text: string) {
    const chat = this.chats.get(chatId);
    if (!chat || !chat.members.includes(this.meId)) {
      this.sendError("That chat isn't yours");
      return;
    }
    if (text.length > 1000) {
      this.sendError('Message must be at most 1000 characters');
      return;
    }
    const othersOnline = chat.members
      .map((id) => this.people.get(id))
      .filter((person) => person && person.online && person.id !== this.meId);
    if (othersOnline.length === 0) {
      this.sendError('Nobody in this chat is online');
      return;
    }
    // relayed, never stored: whoever is connected gets it, the sender included
    this.emit({
      type: 'message',
      chat_id: chat.id,
      from_id: this.meId,
      text,
      sent_at: new Date().toISOString(),
    });

    // and then somebody in there answers, because otherwise this page is a
    // monologue and you can't see what an incoming message looks like
    const answering = pick(othersOnline.filter((person): person is Person => !!person));
    this.later(() => {
      if (!this.meId || !this.chats.has(chat.id) || !answering.online) {
        return;
      }
      this.emit({
        type: 'message',
        chat_id: chat.id,
        from_id: answering.id,
        text: pick(REPLIES),
        sent_at: new Date().toISOString(),
      });
    }, 1200 + Math.random() * 1600);
  }

  private createGroup(userIds: string[], name: string) {
    const broken = validateGroupName(name);
    if (broken) {
      this.sendError(broken);
      return;
    }
    if (userIds.length === 0) {
      this.sendError('Pick at least one person for the group');
      return;
    }
    if (userIds.some((id) => !this.people.get(id)?.online)) {
      this.sendError("Someone you picked isn't here any more");
      return;
    }
    // always a new one: the same people may want several groups, told apart
    // by name. We are added here, from the socket this arrived on.
    const chat: Chat = {
      id: newId('chat'),
      type: 'group',
      name: name.trim(),
      members: [this.meId, ...userIds],
    };
    this.chats.set(chat.id, chat);
    this.sendChats();
    this.emit({ type: 'chat_opened', chat_id: chat.id });
  }

  private addMember(chatId: string, userId: string) {
    const chat = this.chats.get(chatId);
    if (!chat || !chat.members.includes(this.meId)) {
      this.sendError("That chat isn't yours");
      return;
    }
    if (chat.type === 'private') {
      this.sendError('A private chat is just the two of you');
      return;
    }
    if (chat.members.includes(userId)) {
      this.sendError("They're already in this group");
      return;
    }
    if (!this.people.get(userId)?.online) {
      this.sendError("They aren't here any more");
      return;
    }
    chat.members = [...chat.members, userId];
    this.sendChats();
  }

  private removeMember(chatId: string, userId: string) {
    const chat = this.chats.get(chatId);
    if (!chat || !chat.members.includes(this.meId)) {
      this.sendError("That chat isn't yours");
      return;
    }
    if (chat.type === 'private') {
      this.sendError('A private chat is just the two of you');
      return;
    }
    if (!chat.members.includes(userId)) {
      this.sendError("They aren't in this group");
      return;
    }
    chat.members = chat.members.filter((id) => id !== userId);
    // the last person out takes the group with them
    if (chat.members.length === 0) {
      this.chats.delete(chat.id);
    }
    this.sendChats();
  }

  // -------------------------------------------------------------- ambience

  private startAmbience() {
    this.every(() => this.churn(), CHURN_MS);
    this.later(() => this.unpromptedMessage(), FIRST_DM_MS);
  }

  // somebody walks in, or somebody closes their laptop
  private churn() {
    const bots = [...this.people.values()].filter((person) => person.bot);
    const here = bots.filter((person) => person.online);
    const away = bots.filter((person) => !person.online);

    const leaving = here.length > 3 && (away.length === 0 || Math.random() < 0.45);
    if (leaving) {
      const who = pick(here);
      who.online = false;
      this.sendUsers();
      this.sendChats();   // they stay in your chats, marked (disconnected)
      this.sendSystem(`${who.user_name} has left the chat`);
      return;
    }
    if (away.length > 0) {
      const who = pick(away);
      who.online = true;
      this.sendUsers();
      this.sendChats();
      this.sendSystem(`${who.user_name} has joined the chat`);
    }
  }

  // A room already in progress: one private chat with something said in it, and
  // a group with two lines nobody has read yet. Only for ?demo, so a page that
  // is mostly empty by nature can still be looked at.
  demo() {
    const bots = this.online().filter((person) => person.bot);
    if (!this.meId || bots.length < 3) {
      return;
    }
    const [first, second, third] = bots;

    const group: Chat = {
      id: newId('chat'),
      type: 'group',
      name: 'kitchen',
      members: [this.meId, first.id, second.id, third.id],
    };
    const priv: Chat = {
      id: newId('chat'),
      type: 'private',
      name: null,
      members: [this.meId, first.id],
    };
    this.chats.set(group.id, group);
    this.chats.set(priv.id, priv);
    this.sendChats();

    const minutesAgo = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
    const said: Array<[string, string, string, number]> = [
      [priv.id, first.id, 'you around?', 6],
      [priv.id, this.meId, 'at the desk. what?', 5],
      [priv.id, first.id, 'printer ate the form again', 5],
      [priv.id, this.meId, 'coming down', 4],
      [group.id, second.id, 'who took the good chair', 3],
      [group.id, third.id, 'that was me', 2],
    ];
    for (const [chatId, fromId, text, mins] of said) {
      this.emit({
        type: 'message',
        chat_id: chatId,
        from_id: fromId,
        text,
        sent_at: minutesAgo(mins),
      });
    }
    this.emit({ type: 'chat_opened', chat_id: DEMO_OPEN === 'group' ? group.id : priv.id });
  }

  // one person messages you first, so the unread count is worth looking at
  private unpromptedMessage() {
    const others = this.online().filter((person) => person.bot);
    if (!this.meId || others.length === 0) {
      return;
    }
    const who = pick(others);
    const existing = [...this.chats.values()].find(
      (chat) =>
        chat.type === 'private' && chat.members.includes(this.meId) && chat.members.includes(who.id),
    );
    const chat: Chat =
      existing ?? {
        id: newId('chat'),
        type: 'private',
        name: null,
        members: [this.meId, who.id],
      };
    this.chats.set(chat.id, chat);
    this.sendChats();
    this.emit({
      type: 'message',
      chat_id: chat.id,
      from_id: who.id,
      text: pick(OPENERS),
      sent_at: new Date().toISOString(),
    });
  }
}

export const net = new MockNet();
