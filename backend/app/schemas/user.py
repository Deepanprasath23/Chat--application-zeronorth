from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr

class UserBase(BaseModel):
    email: EmailStr
    username: str
    description: Optional[str] = "Available"

class UserOut(UserBase):
    id: int
    is_online: bool
    last_seen: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserSearchOut(UserBase):
    id: int
    is_online: bool

    model_config = ConfigDict(from_attributes=True)

class UserUpdateProfile(BaseModel):
    description: Optional[str] = None
