from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime


class User(BaseModel):
    id: uuid.UUID
    user_name: str
    joined_at: datetime

class Validate:
    USERNAME_MIN_LENGTH : int = 4
    USERNAME_MAX_LENGTH : int = 20

class AppState(BaseModel):
    # frozen: nobody can edit a state object. The reducer returns a new one instead.
    model_config = ConfigDict(frozen=True)

    users: dict[uuid.UUID, User] = {} #Map user_id to user object

class Event(BaseModel):
    type: str
    user: User | None = None
    user_id: uuid.UUID | None = None

class Command(BaseModel):
    type: str
    user_id: uuid.UUID | None = None 
    code: int | None = None
    reason: str | None = None
    message: dict | None = None