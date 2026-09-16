from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserOut
from app.schemas.message import MessageOut

class ConversationCreateDirect(BaseModel):
    recipient_id: int

class ConversationCreateGroup(BaseModel):
    name: str
    member_ids: List[int]

class AddGroupMembers(BaseModel):
    member_ids: List[int]

class ConversationMemberOut(BaseModel):
    id: int
    user_id: int
    user: UserOut
    role: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ConversationOut(BaseModel):
    id: int
    type: str
    name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    members: List[ConversationMemberOut]
    last_message: Optional[MessageOut] = None

    model_config = ConfigDict(from_attributes=True)
