# Handoff — LocalNetChat, 21 Sep 2026

Read `CLAUDE.md` first: it has the architecture, the wire protocol, the commands and
the gotchas. This file is the state of play, why things are the way they are, and
what to do next.

## Where the project is

Working today, tested on a laptop and a phone on the same Wi-Fi:

- **Join** with a name. Rules: 4–20 characters, at least one digit, trimmed. Checked
  on the page as you type (debounced, against `GET /users/check`) and again on the
  server, which is the real check. A refused join closes with `4002` (broken rule) or
  `4001` (name taken) and a reason the page shows.
- **See who's online**, updated by the server on every join, leave and rename. You are
  marked `(you)`, which works because the server sends each joiner a `welcome` with
  their own id.
- **Rename** while connected, over the socket. Names are unique ignoring case, and the
  check skips you, so `riya1` → `Riya1` is allowed.
- **Private chat.** "Message" next to someone opens a chat (the same chat if either
  of you clicks again) and takes you to `/chat`. Messages are relayed and never
  stored: each page keeps only what arrived while it was connected.
- **A chat survives a disconnect.** The other person shows as `(disconnected)`, the
  conversation stays on screen, and the composer is replaced by a line saying you
  can't send. A chat is dropped only when nobody in it is online.

Pages: `/` join, `/people` "Around you", `/chat`, `/you`, plus `/health` (debug).
`GET /users` returns the server's view of who's online, also for debugging.

## Git

`main`, last commit `904bc55` (the pages refactor). **The whole private-chat feature
is uncommitted** — the owner wanted to test it first. If they're happy, commit it;
if not, fix what they report.

History was rewritten once, on 20 Sep, to move every commit from a stale work email to
their personal one. That's done and pushed. This repo's `.git/config` now holds the
personal identity, and their global config has an `includeIf` for `D:/Xebit/` so work
repos use the work address. Don't undo either.

## Why things are the way they are

- **Event-based core.** The owner wrote the event-architecture doc that xebit's
  `demo_v2` follows, and wanted to practise it here. Hence state + pure reducer +
  commands + one dispatcher. Keep that discipline; it's the point of the project.
- **A private chat is a `Chat` with two members**, not a separate concept, so groups
  later reuse the same model, the same page and the same send path. `type` is stored
  explicitly rather than derived from the member count, because a group that loses
  members is still a group.
- **No friend requests.** The owner designed a request/accept flow, then agreed that
  on one Wi-Fi it costs two clicks for little: the first message *is* the request, and
  the receiver can simply ignore it.
- **Messages are relayed, not stored.** Identities die on disconnect, so there's
  nobody to replay history to. Storage becomes a real decision only when reconnect
  keeps an identity alive.
- **The chat list is personal.** `users` is the same for everyone and is broadcast;
  `chats` differs per person, so it's one `send` per member.
- **The name the socket dialled with is kept separate** from the name the server
  currently knows. The URL uses the first, so neither typing nor a rename makes the
  hook reconnect.

## What's next, in the order I'd do it

1. **Commit the chat feature** once the owner has tested it.
2. **Reconnect.** `shouldReconnect` in the hook, decided by close code: never after
   `4001`/`4002` (the server has already refused), yes after `1006`, with growing
   waits. Two things come with it: tell the user *why* the connection dropped (today
   they just land back on the join page), and the **ghost-name problem** — your own
   dead connection can still hold your name for up to ~40 s, so a quick reconnect is
   refused as taken. A rejoin token is the fix.
3. **Groups.** The `Chat` model already supports them: `type: "group"`, a `name`, and
   more members. Needs `create_group` and `add_member` messages, plus somewhere in the
   UI to pick people. No new plumbing.
4. **History and resume**, once reconnect keeps an identity: keep the last N messages
   per chat in the state, give each an id, and let a client ask for everything after
   one. This is the only item that needs the server to remember messages.
5. **HTTPS on the LAN.** Not optional before audio or video: browsers only give the
   microphone to a secure page. It also unlocks `wss://` and WebTransport if file
   transfer ever goes that way.
6. **Files, then audio and video.** Browser JS can't open raw QUIC, so the realistic
   paths are a WebRTC data channel (same machinery as the calls that come later) or a
   plain HTTP upload. WebTransport needs HTTP/3, which uvicorn doesn't speak.
7. **A UI pass.** There is no styling at all yet. Doing a small pass per block is much
   less painful than one rewrite at the end.

## Known rough edges

None of these are bugs today; they're things the next person should know.

- **No `Origin` check on the handshake.** CORS never applies to WebSockets, so any web
  page could open a socket to the server. Low risk on a home network with no cookies
  and no auth, but it's the one server-side security item still open.
- **No rate limit, and uvicorn's default 16 MB message cap.** Text is capped at 1000
  characters by the Pydantic model, but nothing stops a client flooding messages.
- **Unread counts live only in the page.** They reset on reload, like everything else.
- **Only the latest system line is kept**, on purpose. Earlier ones are dropped.
- **`/chat` has no per-chat URL.** The open chat is component state, so there's no
  deep link and no back button between conversations. `?c=<chat_id>` would fix it.
- **The join page still shows `Status: Disconnected`**, which was meaningful when one
  component rendered both screens. It's noise now.
- **`known_names`** keeps the name of someone who left only while a chat still
  mentions them, which is what lets the other side show `(disconnected)`. It's pruned
  when the chat goes.
- **A browser reload is a new identity.** New socket, new id, new join. Nothing is
  carried over, by design, until the rejoin token exists.

## How to check your work

Both must be clean:

```bash
cd Frontend && npx tsc -b && npx eslint src
```

Then actually run it. The pattern that works well here:

- A **throwaway server on 8799** (never touch the owner's on 8000) with two or three
  script clients from `websockets.sync.client`, which is already in the backend venv.
  Good cases to keep re-testing: a refused join, a rename to someone else's name, a
  rename that only changes case, a message into a chat you're not in, an empty or
  over-long message, and a member dropping mid-chat.
- The **real page in headless Chrome** over the DevTools protocol, with a script
  client as the second person. It can type, click, read the page text, and capture the
  frames the page sends. That's how the chat flow above was verified.

Stop anything you started, and leave the owner's two dev servers running.
