from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserOut

class MessageCreate(BaseModel):
    content: str

class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender: UserOut
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
