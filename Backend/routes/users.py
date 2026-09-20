from fastapi import APIRouter
from realtime.manager import ws_manager

router = APIRouter(prefix="/users")

@router.get("")
async def list_users():
    return ws_manager.get_users()

@router.get("/check")
async def check_username(username: str):
    username = username.strip()
    is_available = ws_manager.verify_username(username)
    return {"available": is_available}
