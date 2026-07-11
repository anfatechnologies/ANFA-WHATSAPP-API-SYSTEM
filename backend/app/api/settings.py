# /backend/app/api/settings.py
# ANFA Settings API - System Configuration & Meta Credential Management
# All settings are stored in Redis for instant propagation without restarts.

import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_access_token, encrypt_redis_secret, decrypt_redis_secret
from app.schemas.pydantic_models import (
    SystemSettings,
    MetaCredentialsSettings,
    PhoneNumberConfigCreate,
    PhoneNumberConfigResponse,
    PhoneNumberConfigUpdate,
)
from app.models.schema import PhoneNumberConfig
from sqlalchemy import select

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

@router.get("/system", response_model=SystemSettings)
async def get_system_settings(
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> SystemSettings:
    """Retrieve current system settings from Redis.
    
    Returns default values if no custom settings have been stored.
    """
    redis_client = await _get_redis()
    try:
        stored = await redis_client.get("settings:system")
        if stored:
            return SystemSettings(**json.loads(stored))
        return SystemSettings()
    except json.JSONDecodeError:
        logger.error("Corrupted system settings in Redis, returning defaults")
        return SystemSettings()
    finally:
        await redis_client.close()


@router.post("/system", response_model=SystemSettings)
async def update_system_settings(
    new_settings: SystemSettings,
    token_payload: Dict[str, Any] = Depends(verify_access_token),
) -> SystemSettings:
    """Update system settings in Redis.
    
    Changes take effect immediately without requiring service restarts.
    """
    redis_client = await _get_redis()
    try:
        await redis_client.set(
            "settings:system",
            json.dumps(new_settings.model_dump(), default=str),
        )
        logger.info(f"System settings updated by agent {token_payload.get('sub')}")
        return new_settings
    finally:
        await redis_client.close()


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
