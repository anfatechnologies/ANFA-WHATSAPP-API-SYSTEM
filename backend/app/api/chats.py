# /backend/app/api/chats.py
# ANFA Chats API - Chat Sessions and Messaging Endpoints

import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
async def send_message(
    payload: OutboundTextMessage,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send an outbound message from agent to contact via Meta WhatsApp API.

    Flow:
    1. Find the active session for this recipient.
    2. Save a DB record with status=QUEUED (not SENT — that happens via status webhook).
    3. Enqueue a real ARQ job to send the message through Meta Graph API.
    4. Return the pending message so the UI can optimistically show it.
    """
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

    # 1. Save message to DB — status starts as QUEUED until Meta confirms
    import datetime
    new_message = Message(
        session_id=session.id,
        direction=MessageDirection.OUTBOUND,
        sender_type=MessageSenderType.AGENT,
        # Temporary local ID — real wamid is stored when Meta confirms via status webhook
        message_id=f"local.{uuid.uuid4()}",
        body=payload.body,
        status=MessageStatus.QUEUED,
    )
    db.add(new_message)

    session.last_message_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(new_message)

    # 2. Enqueue real outbound job — send_text_message_task handles Meta Graph API,
    #    rate limiting, 429 backoff, and DLQ fallback.
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool:
        await arq_pool.enqueue_job(
            "send_text_message_task",
            payload.phone_number_id,  # which WhatsApp number to send from
            payload.recipient_wa_id,  # recipient phone number
            payload.body,
        )
    else:
        # If ARQ pool is unavailable log critically — do NOT silently drop
        import logging
        logging.getLogger(__name__).critical(
            "ARQ pool unavailable — outbound message saved to DB but NOT sent to Meta. "
            f"message_id={new_message.message_id}"
        )

    return {
        "status": "queued",
        "message_id": new_message.message_id,
        "note": "Message queued for delivery. Status will update via Meta webhook.",
    }
