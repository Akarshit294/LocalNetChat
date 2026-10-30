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
│   ├── files.py            POST /files, GET /files/{id}: a file's bytes, in and out, over HTTP
│   └── websocket.py        /ws: accept, receive loop, cleanup in finally
└── realtime/
    ├── types.py            User, Chat, SharedFile, AppState, Event, Command, and the incoming message models
    ├── reducer.py          reduce(): pure. Every rule lives here.
    ├── manager.py          the one WebSocketManager: state, sockets, lock, dispatch, run
    ├── messages.py         builders for everything sent to a page. Pure.
    └── validation.py       name rules, "is this name taken", and whose token this is. Pure.
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
└── lib/                    api.ts (fetch wrapper, file upload and download), messages.ts (wire
                            types), validation.ts, files.ts (sizes, and saving a downloaded file)
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
| `call_end` | `user_id`, `reason?` | hung up, declined, or cancelled. `reason` says it was something else: `busy`, `no_answer` |

| server → page | fields | who gets it |
|---|---|---|
| `welcome` | `user_id`, `user_name`, `token` | only the person who just joined |
| `users` | `users[]` | everyone |
| `system` | `text` | everyone |
| `chats` | `chats[]` with members and their `online` flag | only that chat's members |
| `chat_opened` | `chat_id` | only the person who asked |
| `message` | `chat_id`, `from_id`, `text`, `sent_at` | that chat's online members |
| `file` | `chat_id`, `file_id`, `from_id`, `name`, `content_type`, `size`, `sent_at` | that chat's online members, the sharer too |
| `renamed` | `new_name` | only the renamer |
| `error` | `reason` | only the sender of the bad request |
| `call_offer` | `from_id`, `sdp` | only the person being called |
| `call_answer` | `from_id`, `sdp` | only the caller |
| `call_candidate` | `from_id`, `candidate` | only the other end of the call |
| `call_end` | `from_id`, `reason?` | only the other end of the call |

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

**Files go over HTTP, and only a note about them over the socket.** The socket is one
TCP connection carrying every chat message, so a 40 MB file on it would hold up
everything behind it. An HTTP request gets its own connection.

| HTTP (the page calls `/api/...`) | carries | answers |
|---|---|---|
| `POST /files?chat_id=&name=` | `Authorization: Bearer <token>`; the body is the file's raw bytes; `Content-Type` is its type | `201 {file_id}` · `401` no or unknown token · `403` not your chat, or nobody else in it online · `400` bad name · `413` over 50 MB |
| `GET /files/{file_id}` | `Authorization: Bearer <token>`; optional `Range: bytes=…` | `200` the raw bytes · `206` one piece, with `Content-Range` · `416` a range starting past the end, with `Content-Range: bytes */<size>` · `401` · `404` no such file, **or not yours**: one answer, so a stranger can't learn which files exist |

**On HTTP, identity comes from the token**, because a request has no socket the
server knows. Each join gets a random token, sent only in `welcome`, and gone when
that person leaves. A `user_id` in the request would do instead only if ids were
secret, and they aren't: `users` sends everyone's to everyone.

A file is kept in memory, in `AppState.files`, until the person who shared it
leaves. The route asks `file_upload_refusal()` before reading the body, so a stranger is
turned away without 50 MB being read, then counts while reading because
`Content-Length` can be missing or lie. The reducer asks `file_upload_refusal()` again
under the lock, and the route answers by whether the file landed, the way
`connect()` does after a join. A new state shares the bytes with the old one, so
holding them in state costs nothing on each change.

A download asks `can_download()`, which takes the chat from the **file**, never from
the request. A chat id the page sends would let someone name a chat of their own
and pass. The rules in `reducer.py` return reasons or yes/no, never status codes;
the route picks the code. `who_is_asking()` is HTTP's half of identity (header,
401) and lives in the route file; `user_for_token()` is the pure half.

**Only media is served as itself.** A file's label is whatever the uploader wrote,
so a file labelled `text/html` and opened from our address would run as our site
(stored XSS). `safe_media_type()` cleans the label (`Image/SVG+xml; charset=…` is
still an SVG), allows only `image/`, `video/` and `audio/`, never SVG (a document
that can carry scripts), and returns the cleaned type, which is the one served:
the label checked and the label sent are the same string. Anything else goes as
`application/octet-stream` with `Content-Disposition: attachment`, and every
response carries `X-Content-Type-Options: nosniff` so the browser never guesses
a type from the bytes.

**`Range` is how a `<video>` skips ahead** without downloading what's before, and
how a broken download resumes. `parse_range()` answers one of three: nothing we
read (no header, several ranges, nonsense: send it all, `200`, which a server may
always do), a piece (`206`), or a range starting at or past the end (`416`).
`bytes=-200` is the last 200 bytes, and an end past the file is cut back to it.
The header counts its end in; the slice leaves it out, hence `end - 1` in
`Content-Range`. The parameter is `range_header` with `alias="range"`, since
`range` would hide Python's own.

**The four `call_*` notes are post.** The server reads `user_id`, sends the same
note to that person with `from_id` in its place (taken from the socket, like every
other identity here), and never looks inside. `sdp` is a string of a few thousand
characters; `candidate` is an object (`candidate`, `sdpMid`, `sdpMLineIndex`,
`usernameFragment`) to pass through whole. The server keeps no record of who is in a
call: the page ends its own call when the other person drops out of `users`, turns
a second caller away itself by answering `call_end` with `reason: "busy"`, and stops
ringing after 30 seconds with `reason: "no_answer"`. `reason` is a plain string the
server passes on unread, so the page can add one without a server change; it's on
the `call_end` form only because Pydantic drops any field a form doesn't name.

Only an **offer** to someone who isn't here gets `error` back, and a caller still
waiting for an answer hangs up on it. Any other note for someone who's gone is about
a call that's already over, so it's dropped quietly rather than toasting a stray error.

When the socket closes mid-call the page ends the call too, and says "Lost the
server, so the call ended". The sound and picture could carry on without it, but
nothing could hang up properly any more.

On the server all four take one path, because it does the same thing with each:
one event, `call_note_sent`, carrying the sender (from the socket), `to_id`, and
the whole note; one reducer branch; one builder, `call_message`, which copies the
note without `user_id` and puts `from_id` last so the socket's id always wins.

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
- **`/users/check` is a hint, not a gate**, on the join page and on /you. Join and
  SAVE only hold back a name that breaks a rule or that the check has already called
  taken. A name still being checked goes through, because the server checks again
  and says why if it refuses. Waiting for the check made a quick Enter do nothing.
  An answer only counts for the name it was about (`useNameCheck` keeps the two
  together), so a slow answer about an earlier name can't land on the current one.
  A taken name is shown on the join page as well as a broken rule (`nameNote`'s
  `taken`): the box shakes for either, so it says why for either.
- **The token lives in a ref in the provider**, never in state or the context: nothing
  is drawn from it, and a page has no reason to hold it. The provider's `shareFile`
  and `downloadFile` attach it. A downloaded file is fetched into the tab as a Blob,
  then saved through a temporary `blob:` link (`saveBlob` in `lib/files.ts`).
- **`request()` labels only a string body as JSON.** A `File` body is sent with the
  browser's own label for it (`image/png`), which is what the server stores.
- **Vite can miss the second of two quick writes to one file.** It re-reads on the
  first change, and a second write a moment later can land after that read, so the
  page runs half the edit (`onShare is not a function` came from this: `ChatPage`
  had the first edit and not the second). Fresh Vite servers are unaffected, so a
  throwaway test can pass while the owner's page fails. If the page acts like old
  code, compare `curl -sk https://localhost:5173/src/<file>` with the disk (the
  served copy has double quotes and compiled JSX), `touch` the stale file, and
  reload the page.
- **The LAN**: Vite needs `--host`, or the page isn't reachable from a phone. On
  Windows the firewall must allow Node on the current network profile. On Linux
  (Arch) firewalld puts the Wi-Fi in the `public` zone, which lets in only ssh, so
  the phone's request is dropped before Vite sees it. Open the port for the session
  with `sudo firewall-cmd --zone=public --add-port=5173/tcp`; it closes again on
  reboot. Don't make it permanent on `public`, which is also the café zone. Only
  5173 needs opening: the phone never talks to 8000. The laptop's
  address changes, so look it up rather than assuming — `Get-NetIPAddress` on
  Windows, `ipconfig getifaddr en0` on macOS, `ip -4 -br addr` on Linux.
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
other tab closing mid-call, the server going away mid-call, a call nobody answers
(30 s), and an answered call lasting past 30 s.

Worth re-testing whenever the reducer changes: a refused join, a rename to someone
else's name, a rename that only changes case, a name with a space in it, a message
into a chat you're not in, an empty or over-long message, a member dropping mid-chat,
adding someone who has just left, and the last person leaving a group.

Worth re-testing whenever files change: a text file and a binary one downloaded byte
for byte, a name with a space, a file over 50 MB (refused by the page, never sent),
the file counting as unread in a chat that isn't open, the sharer leaving (lines
turn to GONE, no DOWNLOAD), and someone outside the chat asking for it (404). In
headless Chrome, hold the `Browser.setDownloadBehavior` connection open for the
whole run: the setting ends with that connection, and downloads then land in the
real `~/Downloads`. A file is picked with `DOM.setFileInputFiles` on the hidden input.

The reducer is pure, so an awkward state is often quicker to check by calling
`reduce()` directly with a hand-built `AppState` than by driving sockets to it.

Always stop a throwaway server afterwards and leave the owner's servers running.
