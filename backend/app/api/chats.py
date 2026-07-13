# /backend/app/api/chats.py
# ANFA Chats API - Chat Sessions and Messaging Endpoints

import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import verify_access_token
from app.models.schema import ChatSession, Message, MessageDirection, MessageSenderType, MessageStatus
from app.schemas.pydantic_models import ChatSessionResponse, MessageResponse, OutboundTextMessage

# Use verify_access_token instead of verify_admin if agents also need access
router = APIRouter(prefix="/chats", tags=["Chats"], dependencies=[Depends(verify_access_token)])

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_sessions(db: AsyncSession = Depends(get_db)):
    """Fetch all chat sessions for the sidebar."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.contact), selectinload(ChatSession.assigned_agent))
        .order_by(ChatSession.updated_at.desc())
    )
    return list(result.scalars().all())

@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch message history for a specific session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id format")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_uuid)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())

@router.post("/send")
async def send_message(payload: OutboundTextMessage, db: AsyncSession = Depends(get_db)):
    """Send an outbound message from agent to contact."""
    # Find the active session for this recipient (simplification: assume there is one open session)
    result = await db.execute(
        select(ChatSession)
        .join(ChatSession.contact)
        .where(ChatSession.contact.has(wa_id=payload.recipient_wa_id))
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    session = result.scalars().first()
    
    if not session:
        raise HTTPException(status_code=404, detail="No active session found for this contact")

    # 1. Save message to DB
    new_message = Message(
        session_id=session.id,
        direction=MessageDirection.OUTBOUND,
        sender_type=MessageSenderType.AGENT,
        message_id=f"wamid.{uuid.uuid4()}", # Mock Meta message ID for now
        body=payload.body,
        status=MessageStatus.SENT
    )
    db.add(new_message)
    
    # Update session's last_message_at
    import datetime
    session.last_message_at = datetime.datetime.now(datetime.timezone.utc)
    
    await db.commit()
    await db.refresh(new_message)
    
    # 2. Trigger background task (ARQ) to send to Meta API
    # In a real setup, we would dispatch this to ARQ.
    
    return {"status": "sent", "message_id": new_message.message_id}
