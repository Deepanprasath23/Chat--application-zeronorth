from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True)
    type = Column(String(20), nullable=False, default="direct")  # "direct" or "group"
    name = Column(String(100), nullable=True)                    # Group name (null for direct)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
