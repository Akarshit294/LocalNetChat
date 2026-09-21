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
  `react-hot-toast` (headless only — see Gotchas).
- **Runs on**: a laptop, reached from phones on the same Wi-Fi. Written on Windows,
  and since run on macOS too, so both command forms are given below.

## Commands

```bash
# backend (from Backend/), reachable from other devices
uv run fastapi dev main.py --host 0.0.0.0        # http://localhost:8000
.venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000   # same thing, no CLI
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000           # macOS/Linux venv layout

# frontend (from Frontend/)
npm run dev -- --host                            # http://localhost:5173, prints the LAN URL

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
│   └── context.ts            the context and useRealtime()
├── pages/                  JoinPage "/", PeoplePage "/people", ChatPage "/chat", YouPage "/you"
├── components/             NameInput, Notices, Health
├── hooks/                  useDebounce, useNameCheck
└── lib/                    api.ts (fetch wrapper), messages.ts (wire types), validation.ts
```

**The rule that keeps it working**: the socket lives in `RealtimeProvider`, above the
router. A page that owns a socket would drop it on every navigation. Pages read
`useRealtime()` and never open a socket.

`<Notices />` is mounted there too, for the same reason: an `error` arrives on a
connection that outlives the page, so what displays it has to outlive the page as
well. No page renders errors itself.

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
- **The LAN**: the backend needs `--host 0.0.0.0` and Vite needs `--host`, or neither
  is reachable from a phone. On Windows the firewall must allow Python and Node on
  the current network profile. The laptop's address changes, so look it up rather
  than assuming — `Get-NetIPAddress` on Windows, `ipconfig getifaddr en0` on macOS.
  The page builds both URLs from `window.location.hostname`, so a phone works with no
  configuration.

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

Worth re-testing whenever the reducer changes: a refused join, a rename to someone
else's name, a rename that only changes case, a name with a space in it, a message
into a chat you're not in, an empty or over-long message, a member dropping mid-chat,
adding someone who has just left, and the last person leaving a group.

The reducer is pure, so an awkward state is often quicker to check by calling
`reduce()` directly with a hand-built `AppState` than by driving sockets to it.

Always stop a throwaway server afterwards and leave the owner's servers running.
