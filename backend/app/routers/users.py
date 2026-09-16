from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserSearchOut, UserOut, UserUpdateProfile

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=List[UserSearchOut])
def get_users(
    q: Optional[str] = Query(None, description="Search query for username or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(User).filter(User.id != current_user.id)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
    users = query.order_by(User.username.asc()).limit(50).all()
    return [UserSearchOut.model_validate(u) for u in users]

@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: UserUpdateProfile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.description is not None:
        current_user.description = payload.description.strip()
    
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)
