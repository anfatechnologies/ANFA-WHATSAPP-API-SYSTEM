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

class Broadcaster:
    def __init__(self):
        self.listen_task: Optional[asyncio.Task] = None
        self.queues: Dict[str, asyncio.Queue] = {}

    async def add_client(self, client_id: str) -> asyncio.Queue:
        q = asyncio.Queue()
        self.queues[client_id] = q
        
        # Start listener if not running
        if self.listen_task is None or self.listen_task.done():
            self.listen_task = asyncio.create_task(self.listen_to_redis())
            
        return q

    def remove_client(self, client_id: str):
        if client_id in self.queues:
            del self.queues[client_id]
            
        # Stop listener if no clients connected
        if not self.queues and self.listen_task and not self.listen_task.done():
            self.listen_task.cancel()
            self.listen_task = None

    async def listen_to_redis(self):
        redis_client: Optional[redis.Redis] = None
        pubsub: Optional[redis.client.PubSub] = None
        try:
            redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            pubsub = redis_client.pubsub()
            await pubsub.subscribe("realtime-messages")
            
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        event_str = _format_sse_event(data)
                        # Fan-out to all connected clients
                        for q in self.queues.values():
                            # Non-blocking put; if queue fills up, client is too slow, but in asyncio it's an infinite queue by default
                            q.put_nowait(event_str)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON in pubsub message: {message['data'][:200]}")
                elif not message:
                    # Periodically send heartbeats on timeout
                    for q in self.queues.values():
                        q.put_nowait(":heartbeat\n\n")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Broadcaster Redis listen error: {e}")
        finally:
            if pubsub:
                await pubsub.unsubscribe("realtime-messages")
                await pubsub.close()
            if redis_client:
                await redis_client.close()

broadcaster = Broadcaster()

async def event_stream_generator(
    request: Request,
    redis_url: str,
    client_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    if not client_id:
        client_id = str(uuid.uuid4())[:8]
        
    client_queue = await broadcaster.add_client(client_id)
    logger.info(f"SSE client {client_id} connected to realtime stream via broadcaster")
    
    try:
        yield _format_sse_event({
            "event_type": "connected",
            "payload": {
                "client_id": client_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": "Connected to ANFA real-time message stream",
            }
        })
        
        while True:
            if await request.is_disconnected():
                logger.info(f"SSE client {client_id} disconnected")
                break
                
            try:
                # Wait for next event from broadcaster with 1s timeout to check disconnects
                event_str = await asyncio.wait_for(client_queue.get(), timeout=1.0)
                yield event_str
            except asyncio.TimeoutError:
                # Check is_disconnected on next loop iteration
                continue
                
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Fatal SSE error for client {client_id}: {e}", exc_info=True)
    finally:
        broadcaster.remove_client(client_id)
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
