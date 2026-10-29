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
    data: bytes
    shared_at: datetime

class Validate:
    USERNAME_MIN_LENGTH : int = 4
    USERNAME_MAX_LENGTH : int = 20
    MESSAGE_MAX_LENGTH : int = 1000
    GROUP_NAME_MIN_LENGTH : int = 1
    GROUP_NAME_MAX_LENGTH : int = 30
    FILE_MAX_BYTES : int = 50 * 1024 * 1024   # 50 MB, all of it in the laptop's memory
    FILE_NAME_MAX_LENGTH : int = 255

class AppState(BaseModel):
    # frozen: nobody can edit a state object. The reducer returns a new one instead.
    model_config = ConfigDict(frozen=True)

    users: dict[uuid.UUID, User] = {} #Map user_id to user object
    chats: dict[uuid.UUID, Chat] = {} #Map chat_id to chat object
    # shared files by file_id, bytes and all. A new state shares these with the old
    # one rather than copying them, so 50 MB here costs nothing on each change.
    files: dict[uuid.UUID, SharedFile] = {}
    # names of people who have left, so their chats can still show who they were
    known_names: dict[uuid.UUID, str] = {}

class Event(BaseModel):
    type: str
    payload: dict = {}

class Command(BaseModel):
    type: str
    user_id: uuid.UUID | None = None
    code: int | None = None
    reason: str | None = None
    message: dict | None = None

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
