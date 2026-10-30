from fastapi import APIRouter, HTTPException, Response
from realtime.validation import validate_username, is_name_taken
from realtime.types import SessionRequest, Event
from realtime.manager import ws_manager
import secrets

router = APIRouter()

@router.post("/sessions")
async def create_session(session_request: SessionRequest):
    """Create a new session by validating user name and returning cookie."""

    name = session_request.user_name.strip()
    error = validate_username(name)
    if error:
        raise HTTPException(status_code=400, detail=error)

    if is_name_taken(ws_manager.state, name):
        raise HTTPException(status_code=409, detail="Username already taken")

    session_id = secrets.token_urlsafe(32) 

    await ws_manager.dispatch(Event(type="session_requested", payload={
        "session_id": session_id, 
        "user_name": name
    }))

    if not ws_manager.state.sessions.get(session_id):
        error = validate_username(name)
        if error:
            raise HTTPException(status_code=400, detail=error)

        if is_name_taken(ws_manager.state, name):
            raise HTTPException(status_code=409, detail="Username already taken")

        # a cookie only ever goes out for a session that was really stored
        raise HTTPException(status_code=409, detail="That name can't be used right now")

    response = Response(status_code=201)
    response.set_cookie(key="session", value=session_id, httponly=True, secure=True, samesite="strict", path="/") 
    
    return response