# /backend/app/api/settings.py
# ANFA Settings API - System Configuration & Meta Credential Management
# All settings are stored in Redis for instant propagation without restarts.

import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.core.config import settings
from app.core.database import get_db
from app.services.settings_service import SettingsService
from sse_starlette.sse import EventSourceResponse
import asyncio
from app.core.security import verify_access_token, encrypt_redis_secret, decrypt_redis_secret, verify_admin, create_access_token, decode_jwt_token
from app.schemas.pydantic_models import (
    SystemSettings,
    MetaCredentialsSettings,
    PhoneNumberConfigCreate,
    PhoneNumberConfigResponse,
    PhoneNumberConfigUpdate,
)
from app.models.schema import PhoneNumberConfig, AuditLog
from sqlalchemy import select
from datetime import timedelta
from jose import jwt, JWTError

router = APIRouter(prefix="/settings", tags=["Settings"])
logger = logging.getLogger(__name__)

# =============================================================================
# REDIS CLIENT HELPER
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
# SYSTEM SETTINGS
# =============================================================================

@router.post("/token")
async def login_for_access_token(admin: dict = Depends(verify_admin)):
    """Generate a JWT token for the admin dashboard using Basic Auth."""
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin, "role": "admin"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/", response_model=SystemSettings)
async def get_settings_dashboard(
    token_payload: dict = Depends(verify_access_token),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all configuration variables required for the Settings Dashboard."""
    sys_settings = await SettingsService.get_settings(db)
    
    # Do not return encrypted secrets in plain text over the API
    return SystemSettings(
        whatsapp_business_account_id=sys_settings.whatsapp_business_account_id,
        phone_number_id=sys_settings.phone_number_id,
        n8n_webhook_url=sys_settings.n8n_webhook_url,
        auto_reply_enabled=sys_settings.auto_reply_enabled,
        default_reply_message=sys_settings.default_reply_message,
        data_retention_days=sys_settings.data_retention_days,
        enable_logging=sys_settings.enable_logging,
        # We don't return the raw secrets here, we could mask them if needed
    )

@router.get("/live")
async def get_settings_live(token: str = None):
    """SSE endpoint for streaming live settings updates to the frontend.

    Auth: JWT token passed as ?token= query param because the native browser
    EventSource API cannot send custom headers. Uses shared decode_jwt_token()
    so any future token validation changes apply here automatically.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    # Use the shared decode function — not a hand-rolled duplicate
    decode_jwt_token(token)  # raises HTTPException on invalid/expired token
        
    async def event_generator():
        redis_client = await SettingsService.get_redis()
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("settings:updates")
        try:
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    yield {
                        "event": "message",
                        "data": message["data"]
                    }
                await asyncio.sleep(0.1)
        finally:
            await pubsub.unsubscribe("settings:updates")
            await redis_client.close()

    return EventSourceResponse(event_generator())

@router.post("/update")
async def update_settings_dashboard(
    payload: dict,
    request: Request,
    token_payload: dict = Depends(verify_access_token),
    db: AsyncSession = Depends(get_db)
):
    """Update configurations, and trigger broadcasts."""
    # Update via service
    updates = {}
    
    # 1. Meta Config
    if "api_config" in payload:
        api_config = payload["api_config"]
        if "businessAccountId" in api_config:
            updates["whatsapp_business_account_id"] = api_config["businessAccountId"]
        if "appId" in api_config:
            updates["phone_number_id"] = api_config["appId"]
        if "appSecret" in api_config and api_config["appSecret"]:
            updates["app_secret"] = api_config["appSecret"]
        if "accessToken" in api_config and api_config["accessToken"]:
            updates["permanent_access_token"] = api_config["accessToken"]
    
    # 2. Automation
    if "automation" in payload:
        automation = payload["automation"]
        if "n8n_webhook_url" in automation:
            updates["n8n_webhook_url"] = automation["n8n_webhook_url"]
        if "auto_reply_enabled" in automation:
            updates["auto_reply_enabled"] = automation["auto_reply_enabled"]
        if "default_reply_message" in automation:
            updates["default_reply_message"] = automation["default_reply_message"]
            
    # 3. Privacy
    if "privacy" in payload:
        privacy = payload["privacy"]
        if "data_retention_days" in privacy:
            updates["data_retention_days"] = int(privacy["data_retention_days"])
            # M4 Fix: Enqueue a real cleanup job when retention policy changes
            arq_pool = getattr(request.app.state, "arq_pool", None)
            if arq_pool:
                await arq_pool.enqueue_job(
                    "cleanup_old_messages",
                    updates["data_retention_days"]
                )
                logger.info(f"Enqueued cleanup_old_messages for {updates['data_retention_days']} days retention")
            else:
                logger.warning("ARQ pool unavailable — cleanup_old_messages not enqueued")
        if "enable_logging" in privacy:
            updates["enable_logging"] = privacy["enable_logging"]
            
    # 4. Admin Credentials (H2)
    if "admin_credentials" in payload:
        # Admin credentials are stored in the environment / .env file.
        # Dynamic runtime updates require an Admin DB table with hashed passwords.
        # That feature is not yet implemented — returning 501 is safer than
        # returning a fake 200 success while silently doing nothing.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Admin credential updates via the UI are not yet implemented. "
                "Update ADMIN_USERNAME / ADMIN_PASSWORD in your .env file and restart the backend."
            ),
        )

    await SettingsService.update_settings(db, updates)
    
    # Audit Logging
    audit = AuditLog(
        action="settings_update",
        resource_type="system_settings",
        details={"updates_keys": list(updates.keys())}
    )
    db.add(audit)
    await db.commit()

    return {"status": "success", "message": "Settings updated"}





# =============================================================================
# META CREDENTIALS MANAGEMENT
# =============================================================================

@router.post("/meta-credentials")
async def store_meta_credentials(
    credentials: MetaCredentialsSettings,
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> Dict[str, str]:
    """Store Meta API credentials in Redis for a specific phone number.
    
    Security Rationale: Credentials are stored per phone_number_id enabling:
    1. Multi-number support with isolated credentials
    2. Zero-downtime credential rotation
    3. No container restarts or Nginx reloads needed
    4. Instant propagation to all worker processes
    
    The webhook verification and signature validation dynamically fetch
    these credentials, eliminating the need for Docker socket access.
    """
    redis_client = await _get_redis()
    try:
        # Store with phone_number_id as part of the key for isolation
        prefix = f"settings:meta_credentials:{credentials.phone_number_id}"
        
        pipeline = redis_client.pipeline()
        pipeline.set(f"{prefix}:verify_token", encrypt_redis_secret(credentials.verify_token))
        pipeline.set(f"{prefix}:app_secret", encrypt_redis_secret(credentials.app_secret))
        if credentials.access_token:
            pipeline.set(f"{prefix}:access_token", encrypt_redis_secret(credentials.access_token))
        await pipeline.execute()
        
        logger.info(
            f"Meta credentials stored for phone_number_id: {credentials.phone_number_id}"
        )
        return {"status": "stored", "phone_number_id": credentials.phone_number_id}
        
    finally:
        await redis_client.close()


@router.get("/meta-credentials/{phone_number_id}")
async def get_meta_credentials(
    phone_number_id: str,
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> Dict[str, Optional[str]]:
    """Retrieve stored Meta credentials (excludes secrets in production).
    
    Returns only metadata - actual secrets are only accessible internally
    by the webhook verification system.
    """
    redis_client = await _get_redis()
    try:
        prefix = f"settings:meta_credentials:{phone_number_id}"
        
        verify_token = await redis_client.get(f"{prefix}:verify_token")
        if verify_token:
            verify_token = decrypt_redis_secret(verify_token)
            
        has_app_secret = await redis_client.exists(f"{prefix}:app_secret")
        has_access_token = await redis_client.exists(f"{prefix}:access_token")
        
        return {
            "phone_number_id": phone_number_id,
            "configured": bool(verify_token and has_app_secret),
            "has_access_token": bool(has_access_token),
            # Only return verify token prefix for identification
            "verify_token_prefix": verify_token[:8] + "..." if verify_token else None,
        }
        
    finally:
        await redis_client.close()


@router.delete("/meta-credentials/{phone_number_id}")
async def delete_meta_credentials(
    phone_number_id: str,
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> Dict[str, str]:
    """Remove Meta credentials for a phone number."""
    redis_client = await _get_redis()
    try:
        prefix = f"settings:meta_credentials:{phone_number_id}"
        
        pipeline = redis_client.pipeline()
        pipeline.delete(f"{prefix}:verify_token")
        pipeline.delete(f"{prefix}:app_secret")
        pipeline.delete(f"{prefix}:access_token")
        await pipeline.execute()
        
        logger.info(f"Meta credentials deleted for phone_number_id: {phone_number_id}")
        return {"status": "deleted", "phone_number_id": phone_number_id}
        
    finally:
        await redis_client.close()


# =============================================================================
# PHONE NUMBER CONFIGURATION (DATABASE-BACKED)
# =============================================================================

@router.post("/phone-numbers", response_model=PhoneNumberConfigResponse)
async def create_phone_number_config(
    config: PhoneNumberConfigCreate,
    db: AsyncSession = Depends(get_db),
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> PhoneNumberConfig:
    """Create a new phone number configuration in the database.
    
    Also stores credentials in Redis for fast webhook access.
    """
    # Check for duplicate phone_number_id
    result = await db.execute(
        select(PhoneNumberConfig).where(
            PhoneNumberConfig.phone_number_id == config.phone_number_id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Phone number {config.phone_number_id} already configured",
        )
    
    # Create database record
    db_config = PhoneNumberConfig(
        phone_number_id=config.phone_number_id,
        display_name=config.display_name,
        business_account_id=config.business_account_id,
        webhook_verify_token=config.webhook_verify_token,
        app_secret=config.app_secret,
        access_token=config.access_token,
        is_active=config.is_active,
        settings=config.settings or {},
    )
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    
    # Also store in Redis for webhook fast-path
    redis_client = await _get_redis()
    try:
        prefix = f"settings:meta_credentials:{config.phone_number_id}"
        pipeline = redis_client.pipeline()
        pipeline.set(f"{prefix}:verify_token", encrypt_redis_secret(config.webhook_verify_token))
        pipeline.set(f"{prefix}:app_secret", encrypt_redis_secret(config.app_secret))
        pipeline.set(f"{prefix}:access_token", encrypt_redis_secret(config.access_token))
        await pipeline.execute()
    finally:
        await redis_client.close()
    
    logger.info(f"Phone number config created: {config.phone_number_id}")
    return db_config


@router.get("/phone-numbers", response_model=list[PhoneNumberConfigResponse])
async def list_phone_number_configs(
    db: AsyncSession = Depends(get_db),
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> list[PhoneNumberConfig]:
    """List all configured phone numbers."""
    result = await db.execute(select(PhoneNumberConfig))
    return list(result.scalars().all())


@router.get("/phone-numbers/{config_id}", response_model=PhoneNumberConfigResponse)
async def get_phone_number_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> PhoneNumberConfig:
    """Get a specific phone number configuration."""
    from uuid import UUID
    result = await db.execute(
        select(PhoneNumberConfig).where(PhoneNumberConfig.id == UUID(config_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone number configuration not found",
        )
    return config


@router.patch("/phone-numbers/{config_id}", response_model=PhoneNumberConfigResponse)
async def update_phone_number_config(
    config_id: str,
    update: PhoneNumberConfigUpdate,
    db: AsyncSession = Depends(get_db),
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> PhoneNumberConfig:
    """Update a phone number configuration."""
    from uuid import UUID
    result = await db.execute(
        select(PhoneNumberConfig).where(PhoneNumberConfig.id == UUID(config_id))
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Phone number configuration not found",
        )
    
    # Update only provided fields
    if update.display_name is not None:
        config.display_name = update.display_name
    if update.is_active is not None:
        config.is_active = update.is_active
    if update.settings is not None:
        config.settings = update.settings
    
    await db.commit()
    await db.refresh(config)
    
    return config
