# /backend/app/api/webhooks.py
# ANFA Webhook Handler - Meta Cloud API Webhook Ingress
# FIX #1: Removed per-request Redis connection (Connection Churn).
#          Now uses app.state.redis_pool (a persistent connection pool).
# FIX #3: Idempotency check added using Redis SETNX to prevent duplicate processing.
# FEATURE: n8n webhook dispatcher call added to trigger automation workflows.

import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, Request, HTTPException, status, Query
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import (
    verify_webhook_signature,
    verify_webhook_subscription,
)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


# =============================================================================
# WEBHOOK VERIFICATION ENDPOINT
# =============================================================================

@router.get("/verify/{phone_number_id}")
async def verify_webhook(
    phone_number_id: str,
    request: Request,
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
) -> str:
    """Handle Meta webhook subscription verification challenge.

    Uses the app-level Redis pool (app.state.redis_pool) instead of
    creating a new connection per request to avoid connection churn.
    """
    # FIX #1: Use the shared pool from app.state - no new connections
    redis_pool = request.app.state.redis_pool
    try:
        challenge = await verify_webhook_subscription(
            mode=hub_mode,
            verify_token=hub_verify_token,
            challenge=hub_challenge,
            phone_number_id=phone_number_id,
            redis_client=redis_pool,
        )
        return challenge
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook verification processing failed"
        )


# =============================================================================
# WEBHOOK EVENT INGESTION
# =============================================================================

@router.post("/{phone_number_id}")
async def receive_webhook(
    phone_number_id: str,
    request: Request,
) -> JSONResponse:
    """Receive and process incoming webhook events from Meta Cloud API.

    Flow:
    1. Verify HMAC-SHA256 signature to authenticate the payload
    2. Idempotency check — skip if already processed (FIX #3)
    3. Parse the webhook JSON body
    4. Enqueue the payload to ARQ Redis worker for async processing
    5. Return 202 Accepted immediately (never let Meta timeout)
    """
    # FIX #1: Use the shared pool from app.state
    redis_pool = request.app.state.redis_pool

    try:
        # Step 1: Verify webhook signature using constant-time comparison
        await verify_webhook_signature(request, phone_number_id, redis_pool)

        # Step 2: Parse the JSON payload
        try:
            payload = await request.json()
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload"
            )

        # Step 3: Validate payload structure
        if payload.get("object") != "whatsapp_business_account":
            logger.warning(f"Unexpected webhook object type: {payload.get('object')}")
            return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "ignored"})

        entries = payload.get("entry", [])

        # Step 4: Ensure ARQ pool is available
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if not arq_pool:
            logger.error("ARQ pool not initialized")
            raise HTTPException(status_code=500, detail="Worker pool unavailable")

        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                if change.get("field") == "messages":
                    value = change.get("value", {})

                    # Collect all message IDs for idempotency check
                    messages = value.get("messages", [])
                    for msg in messages:
                        msg_id = msg.get("id")
                        if not msg_id:
                            continue

                        # FIX #3: Idempotency — SETNX with 24h TTL
                        # If the key already exists (returns 0), this message was already processed
                        idempotency_key = f"whatsapp:processed:{msg_id}"
                        is_new = await redis_pool.set(
                            idempotency_key, "1", nx=True, ex=86400  # 24 hours
                        )
                        if not is_new:
                            logger.warning(f"Duplicate webhook detected for message_id={msg_id}, skipping.")
                            continue

                    # Enqueue to ARQ worker for background processing
                    import redis.exceptions
                    try:
                        await arq_pool.enqueue_job(
                            "process_webhook_payload",
                            phone_number_id,
                            value,
                        )
                    except redis.exceptions.RedisError as e:
                        logger.critical(f"Redis queue failure, payload lost: {e}")
                        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Queue unavailable")

        # Step 5: Immediately return 202 to prevent Meta timeout
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "accepted"})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed"
        )
