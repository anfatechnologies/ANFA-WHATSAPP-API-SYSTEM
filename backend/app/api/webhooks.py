# /backend/app/api/webhooks.py
# ANFA Webhook Handler - Meta Cloud API Webhook Ingress
# Processes incoming WhatsApp events with HMAC-SHA256 signature verification.

import json
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Request, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert
import redis.asyncio as redis

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    verify_webhook_signature,
    verify_webhook_subscription,
    fetch_meta_credentials,
)
from app.models.schema import Contact, ChatSession, Message, PhoneNumberConfig
from app.schemas.pydantic_models import (
    WebhookVerification,
    WebhookPayload,
    MessageCreate,
    MessageDirectionSchema,
    MessageSenderTypeSchema,
    MessageStatusSchema,
    SessionStatusSchema,
)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)

# =============================================================================
# REDIS CLIENT
# =============================================================================

async def _get_redis() -> redis.Redis:
    """Create and return a Redis connection."""
    return redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        db=settings.REDIS_DB,
        decode_responses=True,
    )


# =============================================================================
# WEBHOOK VERIFICATION ENDPOINT
# =============================================================================

@router.get("/verify/{phone_number_id}")
async def verify_webhook(
    phone_number_id: str,
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
) -> str:
    """Handle Meta webhook subscription verification challenge.
    
    When you configure a webhook in Meta Developer Console, Meta sends a
    verification challenge to confirm endpoint ownership. This endpoint
    validates the verify_token and returns the challenge.
    
    Security: The verify_token is fetched dynamically from Redis per
    phone_number_id, preventing unauthorized webhook registrations.
    """
    redis_client = await _get_redis()
    try:
        challenge = await verify_webhook_subscription(
            mode=hub_mode,
            verify_token=hub_verify_token,
            challenge=hub_challenge,
            phone_number_id=phone_number_id,
            redis_client=redis_client,
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
    finally:
        await redis_client.close()


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
    2. Parse the webhook JSON body
    3. Enqueue the payload to ARQ Redis worker for async processing
    4. Return 202 Accepted immediately
    """
    redis_client = await _get_redis()
    try:
        # Step 1: Verify webhook signature using constant-time comparison
        await verify_webhook_signature(request, phone_number_id, redis_client)
        
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
        
        # Step 4: Enqueue to ARQ for background media upload and DB storage
        arq_pool = getattr(request.app.state, "arq_pool", None)
        if not arq_pool:
            logger.error("ARQ pool not initialized")
            raise HTTPException(status_code=500, detail="Worker pool unavailable")
            
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                if change.get("field") == "messages":
                    value = change.get("value", {})
                    await arq_pool.enqueue_job(
                        "process_webhook_payload",
                        phone_number_id,
                        value,
                    )
        
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
    finally:
        await redis_client.close()



