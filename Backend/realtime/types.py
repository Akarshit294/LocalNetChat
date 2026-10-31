from pydantic import BaseModel, ConfigDict, Field
from typing import Literal
import uuid
from datetime import datetime


class User(BaseModel):
    id: uuid.UUID
    user_name: str
    joined_at: datetime
    token: str

class Chat(BaseModel):
    # A private chat is a group of two, so both use the same shape.
    id: uuid.UUID
    type: Literal["private", "group"]
    members: list[uuid.UUID]
    name: str | None = None   # groups only; a private chat is named after the other person

class SharedFile(BaseModel):
    # A file shared into a chat, kept in memory. Its size is len(data), so it isn't
    # stored a second time where the two could disagree.
    id: uuid.UUID
    chat_id: uuid.UUID
    owner_id: uuid.UUID   # who shared it; the file goes when they do
    name: str
    content_type: str
    path: str
    size: int
    shared_at: datetime

class Validate:
    USERNAME_MIN_LENGTH : int = 4
    USERNAME_MAX_LENGTH : int = 20
    MESSAGE_MAX_LENGTH : int = 1000
    GROUP_NAME_MIN_LENGTH : int = 1
    GROUP_NAME_MAX_LENGTH : int = 30
    FILE_MAX_BYTES : int = 20 * 1024 * 1024 * 1024   # 20 GB, written to disk as it arrives
    CHUNK_MAX_SIZE : int = 1 * 1024 * 1024             # how much of a file is read at a time
    DISK_SPARE_BYTES : int = 1 * 1024 * 1024 * 1024    # never fill the laptop's disk past this
    FILE_NAME_MAX_LENGTH : int = 255
    # A login that hasn't connected by then is dropped. The page connects within
    # milliseconds; this only clears logins nobody came back for.
    SESSION_TTL_SECONDS : int = 10

class AppState(BaseModel):
    # frozen: nobody can edit a state object. The reducer returns a new one instead.
    model_config = ConfigDict(frozen=True)

    users: dict[uuid.UUID, User] = {} #Map user_id to user object
    chats: dict[uuid.UUID, Chat] = {} #Map chat_id to chat object
    # what's known about each shared file; its bytes are on disk, at `path`
    files: dict[uuid.UUID, SharedFile] = {}
    # names of people who have left, so their chats can still show who they were
    known_names: dict[uuid.UUID, str] = {}
    sessions: dict[str, str] = {}

class Event(BaseModel):
    type: str
    payload: dict = {}

class Command(BaseModel):
    type: str
    user_id: uuid.UUID | None = None
    code: int | None = None
    reason: str | None = None
    message: dict | None = None
    # "schedule": the reducer can't start a timer, so it asks for one. After
    # `delay` seconds the manager dispatches `event`, like any other event.
    delay: float | None = None
    event: Event | None = None
    path: str | None = None   # "delete_file": the file on disk to remove

# What a client may send us. Anything that doesn't fit one of these is refused,
# so the reducer only ever sees messages of the right shape.

class RenameMessage(BaseModel):
    type: Literal["rename"]
    user_name: str

class OpenChatMessage(BaseModel):
    """Message this person: open the chat we already have, or make one."""
    type: Literal["open_chat"]
    user_id: uuid.UUID

class SendMessage(BaseModel):
    type: Literal["send_message"]
    chat_id: uuid.UUID
    text: str = Field(min_length=1, max_length=Validate.MESSAGE_MAX_LENGTH)

class CreateGroupMessage(BaseModel):
    """Make a group with these people. The sender is added by the server, not listed here.

    The name isn't length-checked here: a bad one should come back as a readable
    error, not as "that message was the wrong shape".
    """
    type: Literal["create_group"]
    user_ids: list[uuid.UUID]
    name: str


class AddMemberMessage(BaseModel):
    """Put this person in the group. Anyone already in it may do this; there are no roles."""
    type: Literal["add_member"]
    chat_id: uuid.UUID
    user_id: uuid.UUID


class RemoveMemberMessage(BaseModel):
    """Take this person out of the group. Your own id here means you are leaving."""
    type: Literal["remove_member"]
    chat_id: uuid.UUID
    user_id: uuid.UUID


# A call's four notes. user_id is who the note is for; who it's from comes
# from the socket. The server passes sdp and candidate on without looking inside.

class SendCallOfferMessage(BaseModel):
    type: Literal["call_offer"]
    user_id: uuid.UUID
    sdp: str

class SendCallAnswerMessage(BaseModel):
    type: Literal["call_answer"]
    user_id: uuid.UUID
    sdp: str

class SendCallCandidateMessage(BaseModel):
    type: Literal["call_candidate"]
    user_id: uuid.UUID
    candidate: dict

class EndCallMessage(BaseModel):
    type: Literal["call_end"]
    user_id: uuid.UUID
    reason: str | None = None

class SessionRequest(BaseModel):
    user_name: str