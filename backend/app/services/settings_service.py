import json
import logging
from typing import Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from app.models.schema import SystemSettings
from app.core.config import settings

logger = logging.getLogger(__name__)

class SettingsService:
    @staticmethod
    async def get_redis() -> redis.Redis:
        return redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            decode_responses=True,
        )

    @staticmethod
    async def get_settings(db: AsyncSession) -> SystemSettings:
        """Fetch the singleton SystemSettings from DB, or create if it doesn't exist."""
        result = await db.execute(select(SystemSettings).where(SystemSettings.id == 1))
        sys_settings = result.scalar_one_or_none()
        
        if not sys_settings:
            sys_settings = SystemSettings(id=1)
            db.add(sys_settings)
            await db.commit()
            await db.refresh(sys_settings)
        
        return sys_settings

    @staticmethod
    async def update_settings(db: AsyncSession, updates: Dict[str, Any]) -> SystemSettings:
        """Update the SystemSettings and broadcast the changes via Redis pub/sub."""
        sys_settings = await SettingsService.get_settings(db)
        
        for key, value in updates.items():
            if hasattr(sys_settings, key):
                setattr(sys_settings, key, value)
        
        await db.commit()
        await db.refresh(sys_settings)
        
        # Broadcast the changes via Redis pub/sub for SSE
        redis_client = await SettingsService.get_redis()
        try:
            # We don't broadcast secrets in plain text over pub/sub
            safe_payload = {
                "whatsapp_business_account_id": sys_settings.whatsapp_business_account_id,
                "phone_number_id": sys_settings.phone_number_id,
                "n8n_webhook_url": sys_settings.n8n_webhook_url,
                "auto_reply_enabled": sys_settings.auto_reply_enabled,
                "default_reply_message": sys_settings.default_reply_message,
                "data_retention_days": sys_settings.data_retention_days,
                "enable_logging": sys_settings.enable_logging,
            }
            await redis_client.publish("settings:updates", json.dumps(safe_payload))
        except Exception as e:
            logger.error(f"Failed to publish settings update: {str(e)}")
        finally:
            await redis_client.close()
            
        return sys_settings
