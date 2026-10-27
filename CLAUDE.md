# CLAUDE.md — LocalNetChat

## Overview

A chat app for one Wi-Fi network. A FastAPI server on a laptop, a React page that
anyone on the same network opens in a browser, and one WebSocket between them. No
cloud, no database, no login, and nothing is remembered after a restart.

It is also a **learning project**. The owner is teaching themselves networking and is
building this to understand WebSockets by hand; their notes live in
`D:\misc\Exploring-Stuff\learning-networking\` and the `CLAUDE.md` there explains how
they like to be taught. Optimise for them understanding the code, not for shipping
speed. Don't reach for a library that hides the part they came to learn.

## Working with the owner

- They give **small, specific tasks** and read every line afterwards. Do exactly the
  task named; list anything else you notice instead of fixing it unasked.
- Keep explanations **short and plain**. Big picture first, then the one next step.
- **Verify before handing back**: type-check, lint, and an actual run (see Testing).
  They will run what you claim.
- **Commit only when asked.** Commit messages are conventional (`feat:`, `refactor:`)
  with a body explaining *why*. This repo commits as their personal identity, set in
  `.git/config`; never let it fall back to a work address.

## Stack

- **Backend**: Python 3.12, FastAPI + uvicorn, Pydantic v2, managed with `uv`.
  No database, no Redis, no auth.
- **Frontend**: React 19, TypeScript, Vite 8, `react-router-dom`, `react-use-websocket`,
  `react-hot-toast` (headless only — see Gotchas). Served over **https** with a
  self-signed certificate (`@vitejs/plugin-basic-ssl`), because calls need it.
- **Calls**: plain browser WebRTC (`RTCPeerConnection`), no library, no STUN, no TURN.
- **Runs on**: a laptop, reached from phones on the same Wi-Fi. Written on Windows,
  and since run on macOS too, so both command forms are given below.

## Commands

```bash
# backend (from Backend/), reachable from other devices
uv run fastapi dev main.py --host 0.0.0.0        # http://localhost:8000
.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000   # same thing, no CLI
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000           # macOS/Linux venv layout

# frontend (from Frontend/)
npm run dev -- --host                            # https://localhost:5173, prints the LAN URL

# checks (from Frontend/) — both must be clean before handing work back
npx tsc -b
npx eslint src
```

Run **one** uvicorn worker. All state is in one process's memory.

## Architecture

The server is event-based, in the style described in
`D:\Xebit\xebit-api\docs\event-architecture-notes.md` (the owner's own doc):

```
socket message  →  event  →  dispatch  →  reduce(state, event)  →  (new state, commands)
                                              pure                       ↓
                                                                    the manager runs them
                                                                    (send / broadcast / close)
```

```
Backend/
├── main.py                 app, CORS, include routers. Nothing else.
├── routes/                 the shell: HTTP and socket entry points only
│   ├── health.py           GET /health
│   ├── users.py            GET /users (debug), GET /users/check?username=
│   └── websocket.py        /ws: accept, receive loop, cleanup in finally
└── realtime/
    ├── types.py            User, Chat, AppState, Event, Command, and the incoming message models
    ├── reducer.py          reduce(): pure. Every rule lives here.
    ├── manager.py          the one WebSocketManager: state, sockets, lock, dispatch, run
    ├── messages.py         builders for everything sent to a page. Pure.
    └── validation.py       username and group-name rules, and "is this name taken". Pure.
```

**The rules that keep it honest**

- `reduce()` is pure: no I/O, no clock, no randomness, no `self`. It returns a new
  `AppState` and a list of commands. Anything random or time-based (user ids, chat
  ids, timestamps) is made in the shell and passed in on the event.
- **Only `dispatch()` writes state**, and it holds an `asyncio.Lock` across
  reduce → store → run commands, so two events can't interleave and leave someone
  with a stale list. Reading state anywhere is fine.
- **Sockets are not state.** `AppState` holds people and chats; `manager.sockets`
  holds `{user_id: WebSocket}` and is used only to carry out commands.
- **The reducer never raises at a client.** It returns a `send` command carrying an
  error message. Only a failed *join* closes the connection, because there is nothing
  to keep open.
- **Broadcast vs send**: `users` and system lines are the same for everyone, so they
  are broadcast. `chats`, `welcome`, `chat_opened` and errors differ per person, so
  they are sent.
- **A group is a `Chat` with more members**, not a separate concept. `message_sent`
  never looks at `chat.type`, so relaying to five people uses the code that relays to
  two. Only *making* a group needed anything new.

```
Frontend/src/
├── App.tsx                 BrowserRouter → RealtimeProvider → Routes
├── realtime/
│   ├── RealtimeProvider.tsx  the one socket and everything the server tells us
│   ├── useCall.ts            the one RTCPeerConnection: a voice or video call, peer to peer
│   └── context.ts            the context and useRealtime()
├── pages/                  JoinPage "/", PeoplePage "/people", ChatPage "/chat", YouPage "/you"
├── components/             NameInput, Notices, CallPanel, Health
├── hooks/                  useDebounce, useNameCheck
└── lib/                    api.ts (fetch wrapper), messages.ts (wire types), validation.ts
```

**The rule that keeps it working**: the socket lives in `RealtimeProvider`, above the
router. A page that owns a socket would drop it on every navigation. Pages read
`useRealtime()` and never open a socket.

`<Notices />` is mounted there too, for the same reason: an `error` arrives on a
connection that outlives the page, so what displays it has to outlive the page as
well. No page renders errors itself.

`<CallPanel />` is mounted beside it, and a call lives in `useCall` inside the
provider, for the same reason twice over: an incoming call has to ring on whatever
page you are on, and a call in progress must not die when you change page.

## The wire protocol

Every message, both directions, is JSON with a `type`.

| page → server | fields | meaning |
|---|---|---|
| `rename` | `user_name` | change my name |
| `open_chat` | `user_id` | message this person: open our chat, or make one |
| `send_message` | `chat_id`, `text` | say something (1–1000 characters) |
| `create_group` | `user_ids[]`, `name` | make a group with these people. Always a new one |
| `add_member` | `chat_id`, `user_id` | put this person in the group |
| `remove_member` | `chat_id`, `user_id` | take them out. Your own id means you're leaving |
| `call_offer` | `user_id`, `sdp` | calling this person. `sdp` is my browser's offer |
| `call_answer` | `user_id`, `sdp` | picked up. `sdp` is my browser's answer |
| `call_candidate` | `user_id`, `candidate` | one address I might be reached at. Several per call |
| `call_end` | `user_id` | hung up, declined, or cancelled |

| server → page | fields | who gets it |
|---|---|---|
| `welcome` | `user_id`, `user_name` | only the person who just joined |
| `users` | `users[]` | everyone |
| `system` | `text` | everyone |
| `chats` | `chats[]` with members and their `online` flag | only that chat's members |
| `chat_opened` | `chat_id` | only the person who asked |
| `message` | `chat_id`, `from_id`, `text`, `sent_at` | that chat's online members |
| `renamed` | `new_name` | only the renamer |
| `error` | `reason` | only the sender of the bad request |
| `call_offer` | `from_id`, `sdp` | only the person being called |
| `call_answer` | `from_id`, `sdp` | only the caller |
| `call_candidate` | `from_id`, `candidate` | only the other end of the call |
| `call_end` | `from_id` | only the other end of the call |

Incoming messages are matched to a Pydantic model by their `type`
(`INCOMING_MESSAGES` in `manager.py`). Wrong shape or unknown type gets an `error`
back and the connection stays open; a message that isn't JSON is ignored. So the
reducer only ever sees well-shaped messages.

**Identity comes from the socket**, never from the message body. `handle_message`
takes the `user_id` the route knows and ignores any id inside the payload. So
`create_group` carries only the *other* people; the server adds the sender.

**Membership changes carry one person, not a list.** A single `update_group` holding
the whole membership would let a stale page silently drop anyone added since it last
heard. The lock stops corruption, not clobbering.

**The four `call_*` notes are post.** The server reads `user_id`, sends the same
note to that person with `from_id` in its place (taken from the socket, like every
other identity here), and never looks inside. `sdp` is a string of a few thousand
characters; `candidate` is an object (`candidate`, `sdpMid`, `sdpMLineIndex`,
`usernameFragment`) to pass through whole. The server keeps no record of who is in a
call: the page ends its own call when the other person drops out of `users`, and
turns a second caller away itself by answering `call_end`. If the server can't
deliver a note it answers `error`, and a caller still waiting for an answer hangs up.

> As of 9 Oct 2026 the page speaks all of this and the server relays none of it: the
> owner is writing that half. Until then every `call_*` gets
> `Unknown message type` back.

**`error` says only what went wrong, not what it refused.** There is no id tying it
back to the request, so the page can't put a message beside the button that caused
it. Fine for a notice; a correlation id is the fix if that changes.

## Gotchas

- **`react-use-websocket` must be imported by its inner path**:
  `import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket'`.
  The package is CommonJS-only, and Vite 8 gives the default import the whole export
  object, so `import useWebSocket from 'react-use-websocket'` throws
  "useWebSocket is not a function". `ReadyState` still comes from the package root.
- **`react-hot-toast` is used headless**: `import { toast, useToaster, resolveValue }
  from 'react-hot-toast/headless'`. The library keeps the queue and the dismiss
  timers; `Notices.tsx` does all the rendering, so there is no borrowed styling to
  undo in the UI pass. Named import, not default — its `exports` map has a real
  `import` condition, which is exactly what `react-use-websocket` lacks.
- **Don't call setState directly inside a `useEffect`.** The lint rule
  `react-hooks/set-state-in-effect` rejects it. Socket messages are handled in the
  hook's `onMessage` option instead.
- **The socket URL must not change while connected.** It's built from `connectName`,
  fixed when you press Connect. Building it from the current name made the hook
  reconnect on every keystroke and again on every rename.
- **The two validation files mirror each other**: `Backend/realtime/validation.py` and
  `Frontend/src/lib/validation.ts`. Change one, change the other. The backend is the
  real check; the frontend only gives instant feedback. Names are trimmed, then any
  remaining whitespace is refused — usernames (4–20, one digit) and group names
  (1–30, no digit needed, not unique) alike. Trimming happens inside the validators,
  so every door behaves the same.
- **`/users/check` doesn't know who's asking**, so it reports your own name as taken.
  The page allows a case-only rename anyway; the server skips you by id.
- **The LAN**: Vite needs `--host`, or the page isn't reachable from a phone. On
  Windows the firewall must allow Node on the current network profile. The laptop's
  address changes, so look it up rather than assuming — `Get-NetIPAddress` on
  Windows, `ipconfig getifaddr en0` on macOS.
- **The page never dials the backend itself.** It calls its own origin — `/api/...`
  and `/ws` — and Vite forwards those to uvicorn on `127.0.0.1` (`vite.config.ts`).
  An https page may not call an `http://` or `ws://` address, so this is what lets
  the backend stay plain http. It also means a phone only ever talks to Vite, and a
  backend route is `/api/health` from the page but still `/health` on port 8000.
  The target is `127.0.0.1`, not `localhost`, which can resolve to IPv6 and reach
  something else listening on the same port.
- **https is for the camera.** `navigator.mediaDevices` does not exist on a page
  that isn't secure, and `http://192.168.x.x` isn't (only `localhost` gets a pass).
  The certificate is self-signed, so each device warns once and you choose to go on.
  If a phone accepts the page but its socket never connects, the fix is a
  certificate the phone trusts (`mkcert`, with its root installed on the phone).
- **Calls only work on one network.** `iceServers` is empty, so the only candidates
  are host ones: each device's own Wi-Fi address. A guest network that stops devices
  talking to each other ("client isolation") will ring and then fail to connect.
- **A call's kind is fixed when it starts.** Voice or video is decided by the offer;
  the callee reads it off the `m=video` line. Mute and camera-off only disable a
  track, so nothing is renegotiated. Turning a voice call into a video call would
  need a second offer mid-call, which nothing here does yet.

## Testing

There is no test suite. Work is verified by running it:

1. **A throwaway server on port 8799** with script clients, so the owner's own server
   on 8000 is left alone:
   ```bash
   .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8799   # Windows
   .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8799           # macOS/Linux
   ```
   then drive it with `websockets.sync.client` (the library is already in the venv).
2. **The real page in headless Chrome**, driven over the DevTools protocol, with a
   script client playing the second person. Scripts live in the session scratchpad;
   they type into the box, click buttons, read `document.body.innerText`, and can
   capture the exact frames the page sent.

For calls, Chrome needs three more flags: `--use-fake-ui-for-media-stream` (says yes
to the camera prompt), `--use-fake-device-for-media-stream` (a test pattern and a
beep in place of real devices) and `--ignore-certificate-errors`. Start the
throwaway page with `VITE_SERVER_PORT=8799` so it forwards to the throwaway server,
and give it its own `cacheDir`: two Vite servers sharing `node_modules/.vite` rewrite
each other's dependency cache. Chrome's fake beep is the same in every tab and echo
cancellation can remove it, so to check sound, swap `getUserMedia` for a Web Audio
tone of a different pitch on each page and measure the pitch that arrives.

Worth re-testing whenever calls change: a video call and a voice call end to end
(picture and sound arriving, both ways), mute and camera-off as seen from the other
end, decline, cancel, a third person ringing someone already in a call, a slow or
refused camera prompt on either side, cancelling while the prompt is still up, the
other tab closing mid-call, and the server going away mid-call.

Worth re-testing whenever the reducer changes: a refused join, a rename to someone
else's name, a rename that only changes case, a name with a space in it, a message
into a chat you're not in, an empty or over-long message, a member dropping mid-chat,
adding someone who has just left, and the last person leaving a group.

The reducer is pure, so an awkward state is often quicker to check by calling
`reduce()` directly with a hand-built `AppState` than by driving sockets to it.

Always stop a throwaway server afterwards and leave the owner's servers running.
