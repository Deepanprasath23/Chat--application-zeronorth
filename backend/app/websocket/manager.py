import json
from typing import Dict, Set, List
from fastapi import WebSocket
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.user import User

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> Set of WebSocket instances (supports multiple tabs/devices per user)
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
            first_connection = True
        else:
            first_connection = False

        self.active_connections[user_id].add(websocket)

        if first_connection:
            # Update user online status in DB
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.is_online = True
                    db.commit()
            finally:
                db.close()
            
            # Broadcast presence online update to all connected clients
            await self.broadcast_presence(user_id=user_id, is_online=True)

    async def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
                
                now = datetime.now(timezone.utc)
                # Update user offline status & last_seen in DB
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.id == user_id).first()
                    if user:
                        user.is_online = False
                        user.last_seen = now
                        db.commit()
                finally:
                    db.close()

                # Broadcast presence offline update
                await self.broadcast_presence(
                    user_id=user_id,
                    is_online=False,
                    last_seen=now.isoformat()
                )

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_text(json.dumps(message))

    async def broadcast_to_users(self, message: dict, user_ids: List[int]):
        payload = json.dumps(message)
        for uid in user_ids:
            if uid in self.active_connections:
                for ws in list(self.active_connections[uid]):
                    try:
                        await ws.send_text(payload)
                    except Exception:
                        # Dead connection cleanup handled on disconnect
                        pass

    async def broadcast_presence(self, user_id: int, is_online: bool, last_seen: str = None):
        event = {
            "type": "presence_update",
            "payload": {
                "user_id": user_id,
                "is_online": is_online,
                "last_seen": last_seen
            }
        }
        payload = json.dumps(event)
        for u_connections in list(self.active_connections.values()):
            for ws in list(u_connections):
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass

manager = ConnectionManager()
