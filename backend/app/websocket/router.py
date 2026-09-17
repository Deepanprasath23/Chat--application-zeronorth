from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, set_current_user
from app.core.security import decode_token
from app.models.user import User
from app.models.conversation import Conversation
from app.models.member import ConversationMember
from app.models.message import Message
from app.schemas.user import UserOut
from app.schemas.message import MessageOut
from app.websocket.manager import manager
import json
from datetime import datetime, timezone

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("user_id") or payload.get("sub")
    db: Session = SessionLocal()
    user = None
    try:
        user_id_int = int(user_id)
        user = db.query(User).filter(User.id == user_id_int).first()
    except (ValueError, TypeError):
        email = payload.get("email")
        if email:
            user = db.query(User).filter(User.email == email).first()

    if not user:
        db.close()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    current_user_id = user.id
    set_current_user(db, current_user_id)
    db.close()

    # Accept connection and register in ConnectionManager
    await manager.connect(websocket, current_user_id)

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
            except Exception:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "payload": {"message": "Invalid JSON format"}
                }))
                continue

            event_type = data.get("type")

            if event_type == "send_message":
                conversation_id = data.get("conversation_id")
                content = (data.get("content") or "").strip()

                if not conversation_id or not content:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "payload": {"message": "conversation_id and content are required"}
                    }))
                    continue

                db_session = SessionLocal()
                try:
                    set_current_user(db_session, current_user_id)
                    # Check membership authorization
                    membership = db_session.query(ConversationMember).filter(
                        ConversationMember.conversation_id == conversation_id,
                        ConversationMember.user_id == current_user_id
                    ).first()

                    if not membership:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "payload": {"message": "Unauthorized to send message to this conversation"}
                        }))
                        continue

                    # Save message in DB
                    new_msg = Message(
                        conversation_id=conversation_id,
                        sender_id=current_user_id,
                        content=content
                    )
                    db_session.add(new_msg)
                    
                    # Update conversation timestamp
                    conv = db_session.query(Conversation).filter(Conversation.id == conversation_id).first()
                    if conv:
                        conv.updated_at = datetime.now(timezone.utc)

                    db_session.commit()
                    db_session.refresh(new_msg)

                    # Query sender details
                    sender = db_session.query(User).filter(User.id == current_user_id).first()
                    msg_out = MessageOut(
                        id=new_msg.id,
                        conversation_id=new_msg.conversation_id,
                        sender_id=new_msg.sender_id,
                        sender=UserOut.model_validate(sender),
                        content=new_msg.content,
                        created_at=new_msg.created_at
                    )

                    # Fetch member IDs to broadcast to
                    member_records = db_session.query(ConversationMember.user_id).filter(
                        ConversationMember.conversation_id == conversation_id
                    ).all()
                    member_ids = [m[0] for m in member_records]

                    outbound_event = {
                        "type": "new_message",
                        "payload": {
                            "conversation_id": conversation_id,
                            "message": msg_out.model_dump(mode="json")
                        }
                    }

                    await manager.broadcast_to_users(outbound_event, member_ids)

                finally:
                    db_session.close()

            elif event_type == "typing":
                conversation_id = data.get("conversation_id")
                is_typing = data.get("is_typing", False)

                if conversation_id:
                    db_session = SessionLocal()
                    try:
                        member_records = db_session.query(ConversationMember.user_id).filter(
                            ConversationMember.conversation_id == conversation_id
                        ).all()
                        member_ids = [m[0] for m in member_records if m[0] != current_user_id]

                        outbound_event = {
                            "type": "typing_status",
                            "payload": {
                                "conversation_id": conversation_id,
                                "user_id": current_user_id,
                                "is_typing": is_typing
                            }
                        }
                        await manager.broadcast_to_users(outbound_event, member_ids)
                    finally:
                        db_session.close()

    except WebSocketDisconnect:
        await manager.disconnect(websocket, current_user_id)
    except Exception:
        await manager.disconnect(websocket, current_user_id)
