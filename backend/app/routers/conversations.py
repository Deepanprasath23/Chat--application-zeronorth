from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.member import ConversationMember
from app.models.message import Message
from app.schemas.conversation import ConversationCreateDirect, ConversationCreateGroup, AddGroupMembers, ConversationOut
from app.schemas.message import MessageOut

router = APIRouter(prefix="/conversations", tags=["Conversations"])

def _format_conversation(conversation: Conversation, db: Session) -> ConversationOut:
    # Fetch last message
    last_msg = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .first()
    )
    
    last_msg_out = MessageOut.model_validate(last_msg) if last_msg else None
    
    conv_out = ConversationOut.model_validate(conversation)
    conv_out.last_message = last_msg_out
    return conv_out

@router.get("", response_model=List[ConversationOut])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find conversation IDs where user is a member
    user_memberships = db.query(ConversationMember.conversation_id).filter(
        ConversationMember.user_id == current_user.id
    ).all()
    
    conv_ids = [m[0] for m in user_memberships]
    if not conv_ids:
        return []

    conversations = (
        db.query(Conversation)
        .options(joinedload(Conversation.members).joinedload(ConversationMember.user))
        .filter(Conversation.id.in_(conv_ids))
        .order_by(Conversation.updated_at.desc())
        .all()
    )

    result = []
    for conv in conversations:
        result.append(_format_conversation(conv, db))
    
    return result

@router.post("/direct", response_model=ConversationOut)
def create_direct_conversation(
    payload: ConversationCreateDirect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create a 1-on-1 conversation with yourself"
        )
    
    recipient = db.query(User).filter(User.id == payload.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user not found"
        )

    # Check if a direct conversation already exists between current_user and recipient
    existing_conv = (
        db.query(Conversation)
        .join(ConversationMember)
        .filter(Conversation.type == "direct")
        .filter(ConversationMember.user_id.in_([current_user.id, payload.recipient_id]))
        .group_by(Conversation.id)
        .having(func.count(ConversationMember.user_id) == 2)
        .first()
    )

    if existing_conv:
        # Load relationships
        conv = (
            db.query(Conversation)
            .options(joinedload(Conversation.members).joinedload(ConversationMember.user))
            .filter(Conversation.id == existing_conv.id)
            .first()
        )
        return _format_conversation(conv, db)

    # Create new direct conversation
    new_conv = Conversation(type="direct", created_by=current_user.id)
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)

    member1 = ConversationMember(conversation_id=new_conv.id, user_id=current_user.id, role="admin")
    member2 = ConversationMember(conversation_id=new_conv.id, user_id=payload.recipient_id, role="member")
    db.add_all([member1, member2])
    db.commit()

    conv = (
        db.query(Conversation)
        .options(joinedload(Conversation.members).joinedload(ConversationMember.user))
        .filter(Conversation.id == new_conv.id)
        .first()
    )
    return _format_conversation(conv, db)

@router.post("/group", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_group_conversation(
    payload: ConversationCreateGroup,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group name is required"
        )

    new_conv = Conversation(type="group", name=group_name, created_by=current_user.id)
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)

    # Add creator as admin
    member_ids = set(payload.member_ids)
    member_ids.add(current_user.id)

    members_to_add = []
    for uid in member_ids:
        # Check user exists
        u = db.query(User).filter(User.id == uid).first()
        if u:
            role = "admin" if uid == current_user.id else "member"
            members_to_add.append(
                ConversationMember(conversation_id=new_conv.id, user_id=uid, role=role)
            )

    db.add_all(members_to_add)
    db.commit()

    conv = (
        db.query(Conversation)
        .options(joinedload(Conversation.members).joinedload(ConversationMember.user))
        .filter(Conversation.id == new_conv.id)
        .first()
    )
    return _format_conversation(conv, db)

@router.post("/{conversation_id}/members", response_model=ConversationOut)
def add_group_members(
    conversation_id: int,
    payload: AddGroupMembers,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    
    if conv.type != "group":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add members to a direct conversation")

    # Check if current user is member of group
    current_membership = (
        db.query(ConversationMember)
        .filter(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == current_user.id)
        .first()
    )
    if not current_membership or current_membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to modify this conversation")

    # Existing member IDs
    existing_uids = {
        m.user_id for m in db.query(ConversationMember).filter(ConversationMember.conversation_id == conversation_id).all()
    }

    new_members = []
    for uid in payload.member_ids:
        if uid not in existing_uids:
            u = db.query(User).filter(User.id == uid).first()
            if u:
                new_members.append(ConversationMember(conversation_id=conversation_id, user_id=uid, role="member"))

    if new_members:
        db.add_all(new_members)
        db.commit()

    conv = (
        db.query(Conversation)
        .options(joinedload(Conversation.members).joinedload(ConversationMember.user))
        .filter(Conversation.id == conversation_id)
        .first()
    )
    return _format_conversation(conv, db)
