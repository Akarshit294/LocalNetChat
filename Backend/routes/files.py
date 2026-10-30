from fastapi import APIRouter, Header, HTTPException, Request, Response, Cookie
import re
import uuid
from realtime.manager import ws_manager
from realtime.reducer import can_download, file_upload_refusal
from realtime.types import SharedFile, Validate, Event
from realtime.validation import user_for_token, validate_file_name, safe_media_type
from routes.guards import same_origin
from datetime import datetime

router = APIRouter()


# HTTP's half of "who is this?": the session cookie, and 401 if it's nobody's.
# The pure half, whose session this is, is user_for_token in validation.py: a
# session id becomes its user's token when they join.
def who_is_asking(session: str | None) -> uuid.UUID:
    """The user this request is from, by their session cookie. 401 if there's no valid one."""
    user_id = user_for_token(ws_manager.state, session)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Join first")
    return user_id


@router.post("/files", status_code=201)
async def share_file(
    request: Request,                                   # the body is read from this, by hand
    chat_id: uuid.UUID,                                 # ?chat_id=…
    name: str,                                          # ?name=…
    content_type: str | None = Header(default=None),    # Content-Type: what kind of bytes
    content_length: int | None = Header(default=None),  # Content-Length: how many, by its own word
    session: str | None = Cookie(default=None),         # Cookie: session=<id>, sent by the browser itself
):
    """Share a file into a chat. The body is the file's bytes, nothing wrapped around them."""
    # 0. from our own page? The cookie goes along by itself, so a page on another
    # site could make the browser send this POST as you (CSRF)
    if not same_origin(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="Cross-origin request not allowed")

    # 1. who is it? An HTTP request has no socket to say, so the session cookie does
    user_id = who_is_asking(session)

    # 2. may they share into this chat? Asked before the body is read, so a
    # stranger is turned away without us reading 50 MB of theirs
    refusal = file_upload_refusal(ws_manager.state, user_id, chat_id)
    if refusal:
        raise HTTPException(status_code=403, detail=refusal)

    # 3. the name, trimmed like every other name here
    error = validate_file_name(name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # 4. too big by its own word: refused before reading a byte
    if content_length is not None and content_length > Validate.FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="That file is over 50 MB")

    # 5. read it, counting, because Content-Length can be missing or lie
    chunks, total = [], 0
    async for chunk in request.stream():   # the body arrives in pieces; we see each one
        total += len(chunk)
        if total > Validate.FILE_MAX_BYTES:
            raise HTTPException(status_code=413, detail="That file is over 50 MB")
        chunks.append(chunk)

    # 6. the id and the time are made here, never in the reducer
    shared_file = SharedFile(
        id=uuid.uuid4(),
        chat_id=chat_id,
        owner_id=user_id,
        name=name.strip(),
        # no label from the browser means it doesn't know what kind of file this is
        content_type=content_type or "application/octet-stream",
        data=b"".join(chunks),
        shared_at=datetime.now()
    )

    # 7. the reducer stores it and tells the chat
    await ws_manager.dispatch(
        Event(type="file_shared", payload={"file": shared_file})
    )

    # 8. did it land? Reading took a while, and the chat may have changed since
    # step 2. The reducer asked again under the lock, and its answer is the one
    # that counts. The same check connect() makes after a join.
    if shared_file.id not in ws_manager.state.files:
        raise HTTPException(
            status_code=403,
            detail=file_upload_refusal(ws_manager.state, user_id, chat_id) or "The file couldn't be shared",
        )

    return {"file_id": str(shared_file.id)}


# A Range header asks for one piece of a file, which is how a <video> skips
# ahead without downloading everything before that point, and how a broken
# download picks up where it stopped.
UNSATISFIABLE = "unsatisfiable"


def parse_range(header: str | None, total: int) -> tuple[int, int] | str | None:
    """Which bytes a Range header asks for, out of a file of `total` bytes.

    None: no range, or one we don't read (several at once, or nonsense). The
    whole file goes back with 200, which a server is always allowed to do.
    (start, end): data[start:end] goes back with 206. `end` is one past the
    last byte, the way a slice counts; the header itself counts its end in.
    UNSATISFIABLE: a range we can read that starts at or past the end. 416.
    """
    if not header or not header.startswith("bytes="):
        return None
    # "500-999", "500-" or "-200". A comma means several ranges, and doesn't match
    match = re.fullmatch(r"\s*(\d*)\s*-\s*(\d*)\s*", header[len("bytes="):], re.ASCII)
    if not match or match.group(1) == match.group(2) == "":
        return None
    first, last = match.groups()

    if first == "":
        # "-200" is a count from the end: the last 200 bytes
        count = int(last)
        if count == 0 or total == 0:
            return UNSATISFIABLE
        return max(total - count, 0), total

    start = int(first)
    if last != "" and int(last) < start:
        return None   # backwards, so not a range at all
    if start >= total:
        return UNSATISFIABLE
    # an end past the file is cut back to its last byte, not refused
    end = total if last == "" else min(int(last) + 1, total)
    return start, end


@router.get("/files/{file_id}")
async def get_file(
    file_id: uuid.UUID,
    # `range` alone would hide Python's own range(); the alias still reads "Range"
    range_header: str | None = Header(default=None, alias="range"),
    # No Origin check: a GET changes nothing, and another site can't read what
    # comes back. The cookie is what lets a <video> or a link fetch this by itself.
    session: str | None = Cookie(default=None),
):
    """Fetch a file, or one piece of it. The body is its bytes, nothing wrapped around them."""
    user_id = who_is_asking(session)

    # one answer for "no such file" and "not yours", so a stranger can't learn
    # which files exist. GitHub does the same for a private repo you can't see.
    if not can_download(ws_manager.state, user_id, file_id):
        raise HTTPException(status_code=404, detail="No such file")

    shared_file = ws_manager.state.files[file_id]
    total = len(shared_file.data)

    # The cleaned type, served exactly as it was checked. None means it isn't
    # something a browser should show, so it goes as plain bytes and is saved.
    shown = safe_media_type(shared_file.content_type)
    media_type = shown or "application/octet-stream"
    headers = {
        "X-Content-Type-Options": "nosniff",   # use our label, never a guess from the bytes
        "Accept-Ranges": "bytes",              # the browser may ask for pieces
    }
    if not shown:
        headers["Content-Disposition"] = "attachment"

    piece = parse_range(range_header, total)
    if piece == UNSATISFIABLE:
        raise HTTPException(
            status_code=416,
            detail="That range starts past the end of the file",
            headers={"Content-Range": f"bytes */{total}"},   # how big it really is
        )
    if piece is None:
        # Content-Length goes in the headers too; Response sets it from the body
        return Response(content=shared_file.data, media_type=media_type, headers=headers)

    start, end = piece
    # where these bytes sit in the file, and how big the whole file is
    headers["Content-Range"] = f"bytes {start}-{end - 1}/{total}"
    return Response(content=shared_file.data[start:end], status_code=206, media_type=media_type, headers=headers)
