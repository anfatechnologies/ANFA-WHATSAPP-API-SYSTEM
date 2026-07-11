# /backend/app/workers/outbound.py
# ANFA Outbound Message Worker - arq Redis-backed task queue
# Handles WhatsApp message delivery with dynamic rate limiting and 429 handling.

import asyncio
import json
import logging
from typing import Any, Dict, Optional

import httpx
from arq import create_pool, Retry
from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

# =============================================================================
# REDIS SETTINGS FOR ARQ
# =============================================================================

# Build RedisSettings from application configuration
arq_redis_settings = RedisSettings(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD,
    database=settings.REDIS_DB,
)

# =============================================================================
# RATE LIMITING HELPERS
# =============================================================================

async def _check_rate_limit(redis, phone_number_id: str) -> bool:
    """Check sliding-window token bucket rate limit for a phone number.
    
    Uses Redis sorted sets for O(log N) window queries. Each request adds
    a member with the current timestamp as score. We then count members
    within the window to determine if the request is allowed.
    
    Returns True if request is allowed, False if rate limited.
    """
    window_key = f"ratelimit:window:{phone_number_id}"
    now = asyncio.get_event_loop().time()
    window_size = 1.0  # 1-second window
    max_requests = settings.RATE_LIMIT_MESSAGES_PER_SECOND
    
    # Remove entries outside the current window
    await redis.zremrangebyscore(window_key, 0, now - window_size)
    
    # Count requests in current window
    current_count = await redis.zcard(window_key)
    
    if current_count >= max_requests:
        return False
    
    # Add current request timestamp
    await redis.zadd(window_key, {str(now): now})
    # Set expiry on the key to auto-cleanup
    await redis.expire(window_key, int(window_size) + 1)
    
    return True


async def _is_globally_paused(redis, phone_number_id: str) -> Optional[int]:
    """Check if worker is globally paused due to a 429 response.
    
    Returns remaining pause TTL in seconds, or None if not paused.
    """
    pause_key = f"ratelimit:paused:{phone_number_id}"
    ttl = await redis.ttl(pause_key)
    if ttl > 0:
        return ttl
    return None


# =============================================================================
# ARQ WORKER FUNCTIONS
# =============================================================================

async def startup(ctx: Dict[str, Any]) -> None:
    """Worker startup: initialize shared HTTP client."""
    ctx["http_client"] = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=10.0),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    )
    logger.info("Outbound worker HTTP client initialized")


async def shutdown(ctx: Dict[str, Any]) -> None:
    """Worker shutdown: close HTTP client and cleanup."""
    client: httpx.AsyncClient = ctx["http_client"]
    await client.aclose()
    logger.info("Outbound worker HTTP client closed")


async def send_whatsapp_message_job(
    ctx: Dict[str, Any],
    phone_number_id: str,
    recipient: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Process outbound WhatsApp messages via Meta Cloud API.
    
    Execution Flow:
    1. Check global pause (from previous 429 responses)
    2. Check sliding-window rate limit
    3. Send message via Meta Graph API
    4. Handle 429 Too Many Requests with dynamic backoff
    5. Handle other errors with exponential retry
    
    Rate Limiting Strategy:
    - Sliding window counter prevents burst attacks
    - Global pause on 429 stops all workers for the Retry-After duration
    - No container restarts needed - all state in Redis
    
    Args:
        ctx: arq context dictionary containing Redis and HTTP client
        phone_number_id: Meta Phone Number ID for the sending number
        recipient: Recipient WhatsApp ID (phone number)
        payload: Complete message payload per Meta API spec
        
    Returns:
        dict: Meta API response with message ID and status
        
    Raises:
        Retry: Deferred retry on rate limit or transient error
        Exception: Permanent failure after retries exhausted
    """
    redis = ctx["redis"]
    http_client: httpx.AsyncClient = ctx["http_client"]
    
    # -------------------------------------------------------------------------
    # STEP 1: Check global pause (set by previous 429 responses)
    # -------------------------------------------------------------------------
    pause_ttl = await _is_globally_paused(redis, phone_number_id)
    if pause_ttl:
        logger.warning(
            f"Worker paused for {phone_number_id}, "
            f"retrying after {pause_ttl} seconds"
        )
        # Defer task execution until pause expires
        raise Retry(defer=pause_ttl)
    
    # -------------------------------------------------------------------------
    # STEP 2: Check sliding-window rate limit
    # -------------------------------------------------------------------------
    if not await _check_rate_limit(redis, phone_number_id):
        logger.warning(f"Rate limit exceeded for {phone_number_id}, deferring")
        raise Retry(defer=1)  # Retry after 1 second
    
    # -------------------------------------------------------------------------
    # STEP 3: Retrieve access token from Redis cache
    # -------------------------------------------------------------------------
    access_token_key = f"settings:meta_credentials:{phone_number_id}:access_token"
    access_token = await redis.get(access_token_key)
    
    if not access_token:
        # Fallback to settings
        access_token = settings.WHATSAPP_ACCESS_TOKEN
        if not access_token:
            raise Exception(
                f"No access token found for phone_number_id: {phone_number_id}"
            )
    else:
        access_token = access_token.decode("utf-8") if isinstance(access_token, bytes) else access_token
    
    # -------------------------------------------------------------------------
    # STEP 4: Send message via Meta Graph API
    # -------------------------------------------------------------------------
    url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    try:
        response = await http_client.post(url, json=payload, headers=headers)
        
        # -------------------------------------------------------------------------
        # STEP 5: Handle 429 Too Many Requests
        # -------------------------------------------------------------------------
        if response.status_code == 429:
            # Extract Retry-After header or default to 10 seconds
            retry_after_raw = response.headers.get("Retry-After", "10")
            try:
                retry_after = int(retry_after_raw)
            except ValueError:
                retry_after = 10
            
            logger.warning(
                f"429 received from Meta API for {phone_number_id}, "
                f"pausing for {retry_after} seconds"
            )
            
            # Write global pause flag to Redis with TTL
            # This immediately pauses ALL worker processes for this number
            await redis.setex(
                f"ratelimit:paused:{phone_number_id}",
                retry_after,
                "true",
            )
            
            # Defer this specific task as well
            raise Retry(defer=retry_after)
        
        # -------------------------------------------------------------------------
        # STEP 6: Handle other HTTP errors
        # -------------------------------------------------------------------------
        elif response.status_code == 401:
            logger.error(f"401 Unauthorized - invalid access token for {phone_number_id}")
            raise Exception(f"Meta API authentication failed: {response.text}")
            
        elif response.status_code == 400:
            logger.error(f"400 Bad Request: {response.text}")
            # Don't retry bad requests - they're permanent errors
            raise Exception(f"Meta API Bad Request: {response.text}")
            
        elif response.status_code >= 500:
            # Server error - retry with exponential backoff
            logger.warning(f"Meta API server error {response.status_code}: {response.text}")
            raise Retry(defer=5)
            
        elif response.status_code != 200:
            raise Exception(
                f"Meta Cloud API Exception: HTTP {response.status_code} - {response.text}"
            )
        
        # -------------------------------------------------------------------------
        # STEP 7: Success - parse and return response
        # -------------------------------------------------------------------------
        result = response.json()
        logger.info(
            f"Message sent successfully to {recipient} "
            f"via {phone_number_id}: {result.get('messages', [{}])[0].get('id')}"
        )
        return result
        
    except Retry:
        raise
    except Exception:
        raise


async def send_text_message_task(
    ctx: Dict[str, Any],
    phone_number_id: str,
    recipient: str,
    body: str,
    preview_url: bool = False,
) -> Dict[str, Any]:
    """Convenience task for sending text messages.
    
    Constructs the proper Meta API payload and queues the send job.
    """
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {
            "body": body,
            "preview_url": preview_url,
        },
    }
    return await send_whatsapp_message_job(ctx, phone_number_id, recipient, payload)


async def send_template_message_task(
    ctx: Dict[str, Any],
    phone_number_id: str,
    recipient: str,
    template_name: str,
    language_code: str = "en",
    components: Optional[list] = None,
) -> Dict[str, Any]:
    """Convenience task for sending template messages."""
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code,
            },
        },
    }
    if components:
        payload["template"]["components"] = components
    
    return await send_whatsapp_message_job(ctx, phone_number_id, recipient, payload)


# =============================================================================
# ARQ WORKER CONFIGURATION
# =============================================================================

class WorkerConfig:
    """Configuration for arq worker instances."""
    
    redis_settings = arq_redis_settings
    
    # Functions exposed to the worker
    functions = [
        send_whatsapp_message_job,
        send_text_message_task,
        send_template_message_task,
    ]
    
    # Lifecycle hooks
    on_startup = startup
    on_shutdown = shutdown
    
    # Retry configuration
    max_tries = 5  # Maximum retry attempts per job
    job_timeout = 300  # 5 minutes timeout per job
    
    # Health check
    health_check_interval = 30
    
    # Logging
    log_results = True
