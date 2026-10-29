from fastapi import APIRouter, Header, HTTPException, Request
import uuid
from realtime.manager import ws_manager
from realtime.reducer import file_refusal
from realtime.types import SharedFile, Validate, Event
from realtime.validation import user_for_token, validate_file_name
from datetime import datetime

router = APIRouter()

@router.post("/files", status_code=201)
async def share_file(
    request: Request,                                   # the body is read from this, by hand
    chat_id: uuid.UUID,                                 # ?chat_id=…
    name: str,                                          # ?name=…
    content_type: str | None = Header(default=None),    # Content-Type: what kind of bytes
    authorization: str | None = Header(default=None),   # Authorization: Bearer <token>
    content_length: int | None = Header(default=None),  # Content-Length: how many, by its own word
):
    """Share a file into a chat. The body is the file's bytes, nothing wrapped around them."""
    # 1. who is it? An HTTP request has no socket to say, so the token does
    scheme, _, token = (authorization or "").partition(" ")
    user_id = user_for_token(ws_manager.state, token) if scheme.lower() == "bearer" else None
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Join the chat first to share files.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. may they share into this chat? Asked before the body is read, so a
    # stranger is turned away without us reading 50 MB of theirs
    refusal = file_refusal(ws_manager.state, user_id, chat_id)
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
            detail=file_refusal(ws_manager.state, user_id, chat_id) or "The file couldn't be shared",
        )

    return {"file_id": str(shared_file.id)}
