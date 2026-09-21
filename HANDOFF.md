# Handoff — LocalNetChat, 21 Sep 2026

Read `CLAUDE.md` first: it has the architecture, the wire protocol, the commands and
the gotchas. This file is the state of play, why things are the way they are, and
what to do next.

## Where the project is

Working today. Join, rename and private chat were tested on a laptop and a phone on
the same Wi-Fi. The group work and the notices were verified on the laptop only —
script clients against a throwaway server, and the real page in headless Chrome — so
they have not yet been touched on a phone.

- **Join** with a name. Rules: 4–20 characters, at least one digit, no spaces, trimmed.
  Checked on the page as you type (debounced, against `GET /users/check`) and again on
  the server, which is the real check. A refused join closes with `4002` (broken rule)
  or `4001` (name taken) and a reason the page shows.
- **See who's online**, updated by the server on every join, leave and rename. You are
  marked `(you)`, which works because the server sends each joiner a `welcome` with
  their own id.
- **Rename** while connected, over the socket. Names are unique ignoring case, and the
  check skips you, so `riya1` → `Riya1` is allowed.
- **Private chat.** "Message" next to someone opens a chat (the same chat if either
  of you clicks again) and takes you to `/chat`. Messages are relayed and never
  stored: each page keeps only what arrived while it was connected.
- **Groups.** "New group" on `/people` turns the list into checkboxes; tick people,
  name it (1–30 characters, no spaces, no digit needed, not unique) and Create. Open a
  group and you get a member panel: Remove next to anyone, Leave next to yourself, and
  a dropdown of everyone online who isn't in it yet. No roles — anyone in a group may
  add or remove anyone. The last person to leave takes the group with them.
- **A chat survives a disconnect.** The other person shows as `(disconnected)`, the
  conversation stays on screen, and the composer is replaced by a line saying you
  can't send. A chat is dropped only when nobody in it is online.
- **Refusals are visible.** Anything the server turns down appears as a notice and
  takes itself away after a few seconds.

Pages: `/` join, `/people` "Around you", `/chat`, `/you`, plus `/health` (debug).
`GET /users` returns the server's view of who's online, also for debugging.

## Git

`main`, clean tree, everything described above committed. The commits that built it:

- `289a314` groups, adding and removing members, and the no-spaces rule
- `e1567b8` the notices, and the removal of the orphaned `UserList.tsx`
- and the one carrying this file

History was rewritten once, on 20 Sep, to move every commit from a stale work email to
their personal one. That's done and pushed. This repo's `.git/config` now holds the
personal identity, and their global config has an `includeIf` for `D:/Xebit/` so work
repos use the work address. Don't undo either.

## Why things are the way they are

- **Event-based core.** The owner wrote the event-architecture doc that xebit's
  `demo_v2` follows, and wanted to practise it here. Hence state + pure reducer +
  commands + one dispatcher. Keep that discipline; it's the point of the project.
- **A private chat is a `Chat` with two members**, and a group is the same `Chat` with
  more. `message_sent` never looks at `chat.type`, so groups needed no new send path
  and no new command — only a way to make one. `type` is stored explicitly rather than
  derived from the member count, because a group that loses members is still a group.
- **`open_chat` reuses an existing chat, `create_group` never does.** There is only one
  sensible private conversation between two people, but the same people may want
  several groups, told apart by name. This also means two identical groups are possible.
- **Membership changes carry one person each**, not a whole member list. One
  `update_group` holding the full membership would let a stale page silently drop
  anyone added since it last heard. The dispatch lock stops corruption, not clobbering.
- **No friend requests.** The owner designed a request/accept flow, then agreed that
  on one Wi-Fi it costs two clicks for little: the first message *is* the request, and
  the receiver can simply ignore it.
- **Messages are relayed, not stored.** Identities die on disconnect, so there's
  nobody to replay history to. Storage becomes a real decision only when reconnect
  keeps an identity alive.
- **The chat list is personal.** `users` is the same for everyone and is broadcast;
  `chats` differs per person, so it's one `send` per member. A removed member is sent
  one too, so the group leaves their page instead of sitting there until they reload.
- **The name the socket dialled with is kept separate** from the name the server
  currently knows. The URL uses the first, so neither typing nor a rename makes the
  hook reconnect.
- **The toaster is headless.** `react-hot-toast` keeps the queue and the dismiss
  timers; `Notices.tsx` does every bit of the rendering, so there is no borrowed
  styling for the UI pass to undo.

## What's next, in the order I'd do it

1. **Reconnect.** `shouldReconnect` in the hook, decided by close code: never after
   `4001`/`4002` (the server has already refused), yes after `1006`, with growing
   waits. Two things come with it: tell the user *why* the connection dropped (today
   they just land back on the join page), and the **ghost-name problem** — your own
   dead connection can still hold your name for up to ~40 s, so a quick reconnect is
   refused as taken. A rejoin token is the fix.
2. **A first UI pass.** There is still no styling at all: no CSS file, no `className`,
   no `style=` anywhere in `src`. Every block added since makes the eventual pass
   bigger, and there are now two more of them (the group picker, the member panel).
   Doing a little per block hurts much less than one rewrite at the end. The notice is
   deliberately unstyled and waiting for this.
3. **History and resume**, once reconnect keeps an identity: keep the last N messages
   per chat in the state, give each an id, and let a client ask for everything after
   one. This is the only item that needs the server to remember messages.
4. **HTTPS on the LAN.** Not optional before audio or video: browsers only give the
   microphone to a secure page. It also unlocks `wss://` and WebTransport if file
   transfer ever goes that way.
5. **Files, then audio and video.** Browser JS can't open raw QUIC, so the realistic
   paths are a WebRTC data channel (same machinery as the calls that come later) or a
   plain HTTP upload. WebTransport needs HTTP/3, which uvicorn doesn't speak.

## Known rough edges

None of these are bugs today; they're things the next person should know.

- **No `Origin` check on the handshake.** CORS never applies to WebSockets, so any web
  page could open a socket to the server. Low risk on a home network with no cookies
  and no auth, but it's the one server-side security item still open.
- **No rate limit, and uvicorn's default 16 MB message cap.** Text is capped at 1000
  characters by the Pydantic model, but nothing stops a client flooding messages.
- **`error` doesn't say what it refused.** It carries only `reason`, with no id tying
  it back to the request, so a message can't be put beside the button that caused it.
  A notice is fine without that; anything more precise needs a correlation id.
- **Removing someone rewrites their past messages to `someone:`.** `nameOf` looks the
  sender up in the open chat's members, so their earlier lines lose their name the
  moment they leave the group. The server still knows it, in `known_names`; the page
  has no route to it.
- **Anyone can remove anyone**, including whoever made the group. That's what "no roles
  yet" means, but it's worth saying out loud.
- **Two groups with the same name and the same people are indistinguishable** in the
  chat list. The ids differ and the messages stay separate, but nothing tells them
  apart on screen, and nothing stops you making the second one by accident.
- **Messages from a group you left stay in page memory.** Get added back and you'll see
  the old conversation again, which nobody else in the group can see.
- **Unread counts live only in the page.** They reset on reload, like everything else.
- **Only the latest system line is kept**, on purpose. Earlier ones are dropped.
- **`/chat` has no per-chat URL.** The open chat is component state, so there's no
  deep link and no back button between conversations. `?c=<chat_id>` would fix it.
- **The join page still shows `Status: Disconnected`**, which was meaningful when one
  component rendered both screens. It's noise now.
- **`known_names`** keeps the name of someone who left only while a chat still
  mentions them, which is what lets the other side show `(disconnected)`. It's pruned
  when the chat goes, and when they're removed from the last chat naming them.
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
  The cases listed at the end of `CLAUDE.md` are the ones worth re-running.
- **Calling `reduce()` directly** with a hand-built `AppState`. It's pure, so an
  awkward state — an offline member, a name nothing references any more — is quicker
  to set up by hand than to drive sockets into.
- The **real page in headless Chrome** over the DevTools protocol, with script clients
  as the other people. It can type, click, read the page text, and capture the frames
  the page sent. That's how the group flow and the notices were verified.

Two traps worth knowing, both of which cost time here:

- Assert **what the page ended up doing**, not what a test helper returned. A helper
  that clicks and reports `false` while the navigation plainly happened will send you
  hunting a bug that isn't there.
- Scope an assertion to the element you mean. Checking `document.body.innerText` for a
  name matches the system line and the "add someone" dropdown too, and reads as a
  failure when the thing you were actually checking is fine.

Always stop a throwaway server afterwards and leave the owner's servers running.
