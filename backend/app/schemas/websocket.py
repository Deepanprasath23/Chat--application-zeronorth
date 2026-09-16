from typing import Any, Dict, Optional
from pydantic import BaseModel

class WSInboundEvent(BaseModel):
    type: str  # "send_message", "typing", "read_receipt"
    conversation_id: Optional[int] = None
    content: Optional[str] = None
    is_typing: Optional[bool] = None

class WSOutboundEvent(BaseModel):
    type: str  # "new_message", "presence_update", "typing_status", "error"
    payload: Dict[str, Any]
