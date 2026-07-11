import asyncio
import uuid
import logging
from typing import Optional

import redis.asyncio as redis
from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db_session
from app.models.schema import Message
from app.schemas.pydantic_models import MessageStatusSchema

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_redis_connection() -> bool:
    """Ping Redis to ensure ARQ queue is reachable."""
    try:
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB
        )
        await r.ping()
        await r.close()
        logger.info("✅ Redis connection successful. ARQ queue is reachable.")
        return True
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        return False

async def trigger_and_verify_webhook() -> None:
    """Trigger a webhook payload and poll the database for processing status."""
    # Generate a unique message ID for this test
    test_message_id = f"test_msg_{uuid.uuid4().hex[:8]}"
    test_wa_id = "1234567890"
    
    mock_payload = {
        "contacts": [
            {"wa_id": test_wa_id, "profile": {"name": "Test User"}}
        ],
        "messages": [
            {
                "from": test_wa_id,
                "id": test_message_id,
                "type": "image",
                "timestamp": "1610000000",
                "image": {
                    "mime_type": "image/jpeg",
                    "link": "http://example.com/dummy.jpg", # This URL will fail to download, testing the error handling
                    "caption": "Test Image"
                }
            }
        ]
    }
    
    # 1. Enqueue task
    try:
        arq_pool = await create_pool(
            RedisSettings(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                database=settings.REDIS_DB,
            )
        )
        await arq_pool.enqueue_job("process_webhook_payload", "test_phone_id", mock_payload)
        logger.info(f"✅ Enqueued test webhook payload with message ID: {test_message_id}")
    except Exception as e:
        logger.error(f"❌ Failed to enqueue task: {e}")
        return
        
    # 2. Poll Database for PROCESSED status
    max_retries = 10
    retry_interval = 2.0  # seconds
    
    logger.info("Polling database for message processing status...")
    
    for attempt in range(max_retries):
        await asyncio.sleep(retry_interval)
        async with get_db_session(read_only=True) as db:
            result = await db.execute(
                select(Message).where(Message.message_id == test_message_id)
            )
            msg: Optional[Message] = result.scalar_one_or_none()
            
            if msg:
                if msg.status == MessageStatusSchema.PROCESSED:
                    logger.info(f"✅ Success! Message {test_message_id} is PROCESSED.")
                    logger.info(f"   Media URL field: {msg.media_url}")
                    # Note: Since the dummy URL doesn't exist, the MinIO upload should fail inside the worker, 
                    # and media_url will fallback to the raw URL or an internal fallback. 
                    # Worker logs will show the MinIO connection/upload error.
                    return
                else:
                    logger.info(f"   Attempt {attempt + 1}: Message found, but status is {msg.status}. Waiting...")
            else:
                logger.info(f"   Attempt {attempt + 1}: Message not found yet. Waiting...")
                
    logger.error("❌ Polling timed out. Message was not processed in time.")

async def run_diagnostics():
    logger.info("--- Starting System Diagnostics ---")
    redis_ok = await check_redis_connection()
    if not redis_ok:
        logger.error("Aborting diagnostics due to Redis failure.")
        return
        
    await trigger_and_verify_webhook()
    logger.info("--- Diagnostics Complete ---")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
