import json
import logging
from typing import Dict, Any

import httpx
from arq.connections import RedisSettings
from app.core.config import settings
from app.core.database import get_db_session
from app.models.schema import Contact, ChatSession, Message
from app.schemas.pydantic_models import (
    MessageDirectionSchema,
    MessageSenderTypeSchema,
    MessageStatusSchema,
    SessionStatusSchema,
)
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.services.object_storage import ObjectStorageService
from app.core.crypto import crypto_service
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Reusing Redis Settings from config
arq_redis_settings = RedisSettings(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD,
    database=settings.REDIS_DB,
)

async def startup(ctx: Dict[str, Any]) -> None:
    ctx["storage_service"] = ObjectStorageService()
    ctx["redis_pubsub"] = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        db=settings.REDIS_DB,
        decode_responses=True,
    )
    # Shared async HTTP client for n8n webhooks (reused across jobs)
    ctx["http_client"] = httpx.AsyncClient(timeout=10.0)
    logger.info("Inbound Worker startup complete")

async def shutdown(ctx: Dict[str, Any]) -> None:
    if "redis_pubsub" in ctx:
        await ctx["redis_pubsub"].close()
    if "http_client" in ctx:
        await ctx["http_client"].aclose()
    logger.info("Inbound Worker shutdown complete")

async def process_webhook_payload(
    ctx: Dict[str, Any],
    phone_number_id: str,
    value: Dict[str, Any],
) -> None:
    """Task to process webhook payload offloaded from the main API thread."""
    storage_service: ObjectStorageService = ctx["storage_service"]
    
    async with get_db_session(read_only=False) as db:
        try:
            # Process contacts metadata
            contacts_data = value.get("contacts", [])
            contacts_map = {}
            for contact_data in contacts_data:
                wa_id = contact_data.get("wa_id")
                profile = contact_data.get("profile", {})
                if wa_id:
                    contact = await _upsert_contact(db, wa_id, profile.get("name"))
                    contacts_map[wa_id] = contact
            
            # Process messages
            messages_data = value.get("messages", [])
            for msg_data in messages_data:
                message = await _process_incoming_message(
                    db, phone_number_id, msg_data, contacts_map, storage_service, ctx["redis_pubsub"]
                )
                # FEATURE: Dispatch to n8n if enabled and a message was created
                if message and settings.N8N_WEBHOOK_URL:
                    await _dispatch_to_n8n(ctx, phone_number_id, msg_data, message)
            
            # Process status updates
            statuses_data = value.get("statuses", [])
            for status_data in statuses_data:
                await _process_status_update(db, status_data)
                
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to process webhook payload: {e}", exc_info=True)
            # DLQ Implementation for Worker processing failures
            # Why: Ensure that if a payload continually fails even after retries, we save it for manual inspection or replay.
            # How: Pushed to a Redis dead-letter queue specific to processing errors.
            dlq_entry = {
                "phone_number_id": phone_number_id,
                "payload": json.dumps(value),
                "error": str(e)
            }
            await ctx["redis_pubsub"].xadd("dlq:worker_processing_failures", dlq_entry)
            raise


# =============================================================================
# FIX #2: Race Condition — Use PostgreSQL UPSERT (INSERT ... ON CONFLICT)
# =============================================================================

async def _upsert_contact(db, wa_id: str, display_name: str = None) -> Contact:
    """Atomically create or retrieve a contact using PostgreSQL UPSERT.

    This replaces the old SELECT-then-INSERT pattern which caused
    UniqueConstraint race conditions when concurrent workers processed
    messages from the same contact simultaneously.
    """
    stmt = (
        pg_insert(Contact)
        .values(
            wa_id=wa_id,
            display_name=display_name,
            phone_number=wa_id,
        )
        .on_conflict_do_update(
            index_elements=["wa_id"],
            # Only update display_name if it's being provided and is new
            set_=dict(display_name=display_name) if display_name else dict(wa_id=wa_id),
        )
        .returning(Contact)
    )
    result = await db.execute(stmt)
    contact = result.scalar_one()

    # Ensure a ChatSession exists for this contact (also safe for concurrent calls)
    session_stmt = (
        pg_insert(ChatSession)
        .values(
            contact_id=contact.id,
            status=SessionStatusSchema.PENDING,
        )
        .on_conflict_do_nothing(index_elements=["contact_id"])  # Assumes unique index on contact_id for open sessions
    )
    await db.execute(session_stmt)
    await db.flush()

    return contact


async def _process_incoming_message(
    db,
    phone_number_id: str,
    msg_data: Dict[str, Any],
    contacts_map: Dict[str, Contact],
    storage_service: ObjectStorageService,
    redis_pubsub: redis.Redis
) -> Message | None:
    from_wa_id = msg_data.get("from")
    message_id = msg_data.get("id")
    
    msg_type = msg_data.get("type", "text")
    body = None
    media_url = None
    media_type = None
    media_caption = None
    
    # Extract media logic
    if msg_type == "text":
        body = msg_data.get("text", {}).get("body")
    elif msg_type in ["image", "video", "audio", "document", "sticker"]:
        media_data = msg_data.get(msg_type, {})
        raw_media_url = media_data.get("link") or media_data.get("url")
        media_mime = media_data.get("mime_type", "application/octet-stream")
        
        if raw_media_url:
            try:
                internal_url = await storage_service.upload_from_url(raw_media_url, media_mime)
                media_url = internal_url
            except Exception as e:
                logger.error(f"Media upload failed: {e}")
                media_url = raw_media_url
                
        media_type = msg_type
        media_caption = media_data.get("caption")
        body = media_caption
    elif msg_type == "location":
        location = msg_data.get("location", {})
        body = f"Location: {location.get('latitude')}, {location.get('longitude')}"
    elif msg_type == "contacts":
        body = "[Shared contact card]"
    elif msg_type == "button":
        body = msg_data.get("button", {}).get("text", "[Button click]")
    elif msg_type == "interactive":
        interactive = msg_data.get("interactive", {})
        if "button_reply" in interactive:
            body = interactive["button_reply"].get("title", "[Interactive button]")
        elif "list_reply" in interactive:
            body = interactive["list_reply"].get("title", "[List selection]")
        else:
            body = "[Interactive message]"
            
    contact = contacts_map.get(from_wa_id)
    if not contact:
        contact = await _upsert_contact(db, from_wa_id)
        contacts_map[from_wa_id] = contact
        
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.contact_id == contact.id)
        .where(ChatSession.status.in_([SessionStatusSchema.OPEN, SessionStatusSchema.PENDING]))
        .order_by(ChatSession.created_at.desc())
    )
    session = result.scalar_one_or_none()
    
    if not session:
        session = ChatSession(contact_id=contact.id, status=SessionStatusSchema.PENDING)
        db.add(session)
        await db.flush()
        
    message = Message(
        session_id=session.id,
        direction=MessageDirectionSchema.INBOUND,
        sender_type=MessageSenderTypeSchema.CONTACT,
        sender_id=contact.id,
        message_id=message_id,
        # DATA SOVEREIGNTY: Encrypt sensitive message contents at rest
        body=crypto_service.encrypt(body) if body else None,
        media_url=media_url,
        media_type=media_type,
        media_caption=crypto_service.encrypt(media_caption) if media_caption else None,
        status=MessageStatusSchema.PROCESSED,
    )
    db.add(message)
    
    from datetime import datetime, timezone
    session.last_message_at = datetime.now(timezone.utc)
    await db.flush()

    # Real-time event pub/sub
    await redis_pubsub.publish("realtime-messages", json.dumps({
        "event_type": "message_received",
        "payload": {
            "message_id": str(message.id),
            "session_id": str(session.id),
            "contact_wa_id": from_wa_id,
            "body": body,
            "media_type": media_type,
            "media_url": media_url,
            "direction": "inbound",
            "status": "processed"
        }
    }))

    return message


async def _process_status_update(db, status_data: Dict[str, Any]) -> None:
    message_id = status_data.get("id")
    new_status = status_data.get("status")
    
    if not message_id or not new_status:
        return
        
    status_map = {
        "sent": MessageStatusSchema.SENT,
        "delivered": MessageStatusSchema.DELIVERED,
        "read": MessageStatusSchema.READ,
        "failed": MessageStatusSchema.FAILED,
    }
    mapped_status = status_map.get(new_status)
    if mapped_status:
        await db.execute(
            update(Message).where(Message.message_id == message_id).values(status=mapped_status)
        )


# =============================================================================
# FEATURE: n8n Webhook Dispatcher
# =============================================================================

async def _dispatch_to_n8n(
    ctx: Dict[str, Any],
    phone_number_id: str,
    msg_data: Dict[str, Any],
    message: Message,
) -> None:
    """Dispatcher to trigger an n8n automation workflow with DLQ support.
    If n8n is down or times out, the message is placed in a Dead-Letter Queue (Redis Stream)
    for later recovery, ensuring zero data loss.
    """
    http_client = ctx["http_client"]
    redis_client = ctx["redis_pubsub"]
    
    payload = {
        "source": "anfa-whatsapp-platform",
        "phone_number_id": phone_number_id,
        "message_id": str(message.id),
        "session_id": str(message.session_id),
        "wa_message_id": msg_data.get("id"),
        "from": msg_data.get("from"),
        "type": msg_data.get("type"),
        "body": msg_data.get("text", {}).get("body") if msg_data.get("type") == "text" else None,
        "timestamp": msg_data.get("timestamp"),
    }
    
    async def fallback_to_dlq(error_reason: str):
        logger.error(f"Sending to DLQ: {error_reason}")
        dlq_entry = {"payload": json.dumps(payload), "error": error_reason}
        await redis_client.xadd("dlq:n8n_failures", dlq_entry)

    try:
        # Enforce strict timeout specifically for n8n API call
        timeout = httpx.Timeout(5.0)
        response = await http_client.post(
            settings.N8N_WEBHOOK_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-ANFA-Source": "whatsapp-platform",
            },
            timeout=timeout,
        )
        if response.status_code >= 400:
            await fallback_to_dlq(f"HTTP {response.status_code}: {response.text[:100]}")
        else:
            logger.info(f"n8n webhook dispatched successfully for message_id={message.id}")
    except httpx.TimeoutException:
        await fallback_to_dlq("httpx.TimeoutException")
    except Exception as e:
        await fallback_to_dlq(str(e))


class WorkerConfig:
    redis_settings = arq_redis_settings
    functions = [process_webhook_payload]
    on_startup = startup
    on_shutdown = shutdown
    max_tries = 3
    job_timeout = 600
