from fastapi import APIRouter, Header, HTTPException, Request, Cookie
from fastapi.responses import StreamingResponse
import errno
import re
import uuid
from realtime.manager import ws_manager
from realtime.reducer import can_download, file_upload_refusal
from realtime.storage import delete_quietly, free_bytes, path_for
from realtime.types import SharedFile, Validate, Event
from realtime.validation import user_for_token, validate_file_name, safe_media_type
from routes.guards import same_origin
from datetime import datetime
import aiofiles


router = APIRouter()

TOO_BIG = f"That file is over {Validate.FILE_MAX_BYTES // 1024 ** 3} GB"
DISK_FULL = "There isn't room for that file on the server"


def who_is_asking(session: str | None) -> uuid.UUID:
    """The user this request is from, by their session cookie. 401 if there's no valid one."""
    user_id = user_for_token(ws_manager.state, session)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Join first")
    return user_id


@router.post("/files", status_code=201)
async def share_file(
    request: Request,                                   
    chat_id: uuid.UUID,                                 
    name: str,                                         
    content_type: str | None = Header(default=None),    
    content_length: int | None = Header(default=None),  
    session: str | None = Cookie(default=None),         
):
    """Share a file into a chat. The body is the file's bytes, nothing wrapped around them."""
    if not same_origin(request.headers.get("origin"), request.headers.get("host")):
        raise HTTPException(status_code=403, detail="Cross-origin request not allowed")

    user_id = who_is_asking(session)

    refusal = file_upload_refusal(ws_manager.state, user_id, chat_id)
    if refusal:
        raise HTTPException(status_code=403, detail=refusal)

    error = validate_file_name(name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    if content_length is not None and content_length > Validate.FILE_MAX_BYTES:
        raise HTTPException(status_code=413, detail=TOO_BIG)
    if content_length is not None and content_length > free_bytes() - Validate.DISK_SPARE_BYTES:
        raise HTTPException(status_code=507, detail=DISK_FULL)

    file_id = uuid.uuid4()
    path = path_for(file_id)
    total = 0
    try:
        async with aiofiles.open(path, "wb") as f:
            async for chunk in request.stream():
                total += len(chunk)
                if total > Validate.FILE_MAX_BYTES:
                    raise HTTPException(status_code=413, detail=TOO_BIG)
                await f.write(chunk)
    except BaseException as error:
        delete_quietly(path)
        if isinstance(error, OSError) and error.errno == errno.ENOSPC:
            raise HTTPException(status_code=507, detail=DISK_FULL) from error
        raise

    shared_file = SharedFile(
        id=file_id,
        chat_id=chat_id,
        owner_id=user_id,
        name=name.strip(),
        content_type=content_type or "application/octet-stream",
        path=str(path),
        size=total,   # what was written; Content-Length can be missing or lie
        shared_at=datetime.now(),
    )

    await ws_manager.dispatch(
        Event(type="file_shared", payload={"file": shared_file})
    )

    # refused while it uploaded: the reducer has already asked for the file to go
    if shared_file.id not in ws_manager.state.files:
        raise HTTPException(
            status_code=403,
            detail=file_upload_refusal(ws_manager.state, user_id, chat_id) or "The file couldn't be shared",
        )

    return {"file_id": str(shared_file.id)}


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


async def stream_range(file_id: uuid.UUID, path: str, start: int, end: int):
    """The file's bytes from start up to end, a chunk at a time, while it's still shared."""
    async with aiofiles.open(path, "rb") as f:
        await f.seek(start)
        remaining = end - start
        while remaining > 0:
            # the sharer left: stop, so the download fails instead of completing
            if file_id not in ws_manager.state.files:
                return
            chunk = await f.read(min(Validate.CHUNK_MAX_SIZE, remaining))
            if not chunk:
                return
            remaining -= len(chunk)
            yield chunk


@router.get("/files/{file_id}")
async def get_file(
    file_id: uuid.UUID,
    range_header: str | None = Header(default=None, alias="range"),
    session: str | None = Cookie(default=None),
):
    """Fetch a file, or one piece of it, streamed from disk."""
    user_id = who_is_asking(session)

    if not can_download(ws_manager.state, user_id, file_id):
        raise HTTPException(status_code=404, detail="No such file")

    shared_file = ws_manager.state.files[file_id]
    total = shared_file.size

    shown = safe_media_type(shared_file.content_type)
    media_type = shown or "application/octet-stream"
    headers = {
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "bytes",
    }
    if not shown:
        headers["Content-Disposition"] = "attachment"

    piece = parse_range(range_header, total)
    if piece == UNSATISFIABLE:
        raise HTTPException(
            status_code=416,
            detail="That range starts past the end of the file",
            headers={"Content-Range": f"bytes */{total}"},
        )

    # `end` is one past the last byte, like a slice; Content-Range counts its end in
    start, end = piece or (0, total)
    headers["Content-Length"] = str(end - start)
    if piece:
        headers["Content-Range"] = f"bytes {start}-{end - 1}/{total}"

    return StreamingResponse(
        stream_range(file_id, shared_file.path, start, end),
        status_code=206 if piece else 200,
        media_type=media_type,
        headers=headers,
    )
