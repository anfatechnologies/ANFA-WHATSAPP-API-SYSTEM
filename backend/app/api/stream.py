# /backend/app/api/stream.py
# ANFA Real-Time Streaming - Server-Sent Events (SSE) over HTTP/2
# Provides live message updates to the dashboard via persistent connections.

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Request, Query
from fastapi.responses import StreamingResponse
import redis.asyncio as redis

from app.core.config import settings

router = APIRouter(prefix="/chats", tags=["Streaming"])
logger = logging.getLogger(__name__)

# =============================================================================
# SSE EVENT GENERATOR
# =============================================================================

async def event_stream_generator(
    request: Request,
    redis_url: str,
    client_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Asynchronous event generator that listens to Redis Pub/Sub events
    and streams updates to connected clients via Server-Sent Events.
    
    Architecture:
    1. Subscribes to Redis Pub/Sub channel 'realtime-messages'
    2. Webhook handlers publish message events to this channel
    3. Events are forwarded to connected dashboard clients in SSE format
    4. Periodic keepalive heartbeats prevent proxy timeout disconnections
    
    SSE Format:
        data: {"event_type": "...", "payload": {...}}\n\n
    
    Headers:
        X-Accel-Buffering: no - Prevents Nginx from buffering the response,
        ensuring instant chunk transmission to clients.
    """
    # Generate unique client ID for tracking if not provided
    if not client_id:
        client_id = str(uuid.uuid4())[:8]
    
    redis_client: Optional[redis.Redis] = None
    pubsub: Optional[redis.client.PubSub] = None
    
    try:
        # Establish Redis connection with Pub/Sub support
        redis_client = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
        )
        pubsub = redis_client.pubsub()
        
        # Subscribe to the real-time messages channel
        await pubsub.subscribe("realtime-messages")
        logger.info(f"SSE client {client_id} connected to realtime stream")
        
        # Send initial connection event
        yield _format_sse_event({
            "event_type": "connected",
            "payload": {
                "client_id": client_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": "Connected to ANFA real-time message stream",
            }
        })
        
        # Main event loop
        while True:
            # Check if client has disconnected
            if await request.is_disconnected():
                logger.info(f"SSE client {client_id} disconnected")
                break
            
            try:
                # Poll for messages with 1-second timeout
                # This allows periodic client disconnect checks
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                
                if message and message.get("type") == "message":
                    # Parse and forward the event
                    try:
                        data = json.loads(message["data"])
                        yield _format_sse_event(data)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON in pubsub message: {message['data'][:200]}")
                        
                else:
                    # Send periodic keepalive heartbeat to prevent proxy timeouts
                    # Heartbeats use SSE comment format (starts with ':')
                    # which is ignored by EventSource clients
                    yield ":heartbeat\n\n"
                    
            except asyncio.CancelledError:
                # Graceful shutdown on task cancellation
                logger.info(f"SSE generator cancelled for client {client_id}")
                break
            except Exception as e:
                logger.error(f"SSE stream error for client {client_id}: {e}")
                # Yield error event and attempt to continue
                yield _format_sse_event({
                    "event_type": "error",
                    "payload": {"message": "Stream error, attempting to recover"}
                })
                await asyncio.sleep(1)
                
    except asyncio.CancelledError:
        # Expected on client disconnect or server shutdown
        pass
    except Exception as e:
        logger.error(f"Fatal SSE error for client {client_id}: {e}", exc_info=True)
    finally:
        # Cleanup: Unsubscribe and close Redis connection
        try:
            if pubsub:
                await pubsub.unsubscribe("realtime-messages")
                await pubsub.close()
            if redis_client:
                await redis_client.close()
        except Exception as cleanup_error:
            logger.error(f"SSE cleanup error: {cleanup_error}")
        
        logger.info(f"SSE connection closed for client {client_id}")


def _format_sse_event(data: Dict[str, Any]) -> str:
    """Format a dictionary as an SSE event string.
    
    Standard SSE format:
        data: {"key": "value", ...}\n\n
    
    The double newline (\n\n) marks the end of an event.
    """
    return f"data: {json.dumps(data)}\n\n"


# =============================================================================
# SSE ENDPOINT
# =============================================================================

@router.get("/stream")
async def stream_live_updates(
    request: Request,
    client_id: Optional[str] = Query(default=None, description="Optional client identifier for tracking"),
):
    """Server-Sent Events endpoint for real-time message updates.
    
    Returns a StreamingResponse with text/event-stream media type.
    Clients (dashboard) connect via EventSource API and receive
    live notifications for new messages, status updates, and session changes.
    
    Headers:
        - Cache-Control: no-cache, no-transform
            Prevents intermediate proxies from caching or transforming the stream
        - Connection: keep-alive
            Maintains the TCP connection for persistent delivery
        - X-Accel-Buffering: no
            CRITICAL: Prevents Nginx and other reverse proxies from buffering
            the response. Without this, events would be delayed until the buffer
            fills, defeating the purpose of real-time streaming.
    """
    redis_url = settings.redis_url
    
    return StreamingResponse(
        event_stream_generator(request, redis_url, client_id),
        media_type="text/event-stream",
        headers={
            # Prevent all caching - each event is real-time and non-repeatable
            "Cache-Control": "no-cache, no-transform",
            # Maintain persistent connection
            "Connection": "keep-alive",
            # CRITICAL: Disable Nginx proxy buffering for this endpoint
            # Without this header, Nginx buffers chunks and SSE appears delayed
            "X-Accel-Buffering": "no",
            # Ensure content type is recognized by browsers
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )
