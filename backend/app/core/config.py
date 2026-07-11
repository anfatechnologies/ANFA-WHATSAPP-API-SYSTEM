# /backend/app/core/config.py
# ANFA Application Configuration
# Loads all environment variables with validation and type safety.

import os
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Centralized application configuration with strict type validation.
    
    All sensitive values are loaded from environment variables.
    Default values are only provided for non-sensitive configuration.
    """
    
    # =============================================================================
    # APPLICATION SETTINGS
    # =============================================================================
    APP_NAME: str = Field(default="ANFA WhatsApp Platform")
    APP_VERSION: str = Field(default="1.0.0")
    DEBUG: bool = Field(default=False)
    # P1 Fix: Explicit frontend URL for production CORS allow-list
    FRONTEND_URL: Optional[str] = Field(
        default=None,
        description="Frontend origin URL for CORS (e.g. https://crm.yourdomain.com). Required in production."
    )
    
    # =============================================================================
    # DATABASE CONFIGURATION
    # =============================================================================
    DATABASE_URL_PRIMARY: str = Field(..., description="Async PostgreSQL Primary connection URL")
    DATABASE_URL_REPLICA: str = Field(..., description="Async PostgreSQL Replica connection URL")
    DB_POOL_SIZE: int = Field(default=20, ge=5, le=100)
    DB_MAX_OVERFLOW: int = Field(default=10, ge=0, le=50)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=5)
    DB_POOL_RECYCLE: int = Field(default=1800, ge=300)
    
    # =============================================================================
    # REDIS CONFIGURATION
    # =============================================================================
    REDIS_HOST: str = Field(default="redis")
    REDIS_PORT: int = Field(default=6379, ge=1, le=65535)
    REDIS_PASSWORD: Optional[str] = Field(default=None)
    REDIS_DB: int = Field(default=0, ge=0, le=15)
    
    # =============================================================================
    # SECURITY CONFIGURATION
    # =============================================================================
    SECRET_KEY: str = Field(..., min_length=32, description="JWT signing secret")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, ge=5, le=1440)
    ENCRYPTION_MASTER_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef",
        min_length=32,
        description="AES-256-GCM Master Key for Application Level Encryption"
    )
    
    # =============================================================================
    # META CLOUD API CREDENTIALS
    # =============================================================================
    WHATSAPP_ACCESS_TOKEN: Optional[str] = Field(default=None)
    WHATSAPP_APP_SECRET: Optional[str] = Field(default=None)
    WHATSAPP_VERIFY_TOKEN: Optional[str] = Field(default=None)
    
    # =============================================================================
    # TUNELAB ML INTEGRATION
    # =============================================================================
    ATHENA_ML_ENABLE_SERVER_SIDE_CHECKPOINT_PATH_OVERRIDE: bool = Field(default=False)
    TUNELAB_API_ENDPOINT: Optional[str] = Field(default=None)
    TUNELAB_API_KEY: Optional[str] = Field(default=None)

    # =============================================================================
    # N8N AUTOMATION INTEGRATION
    # =============================================================================
    N8N_WEBHOOK_URL: Optional[str] = Field(
        default=None,
        description="Full URL of the n8n webhook trigger node (e.g. http://n8n:5678/webhook/your-uuid). "
                    "When set, every inbound WhatsApp message is dispatched to n8n for automation."
    )
    N8N_ENABLED: bool = Field(
        default=True,
        description="Master switch for n8n dispatching. Set to False to disable without removing the URL."
    )
    
    # =============================================================================
    # RATE LIMITING
    # =============================================================================
    RATE_LIMIT_MESSAGES_PER_SECOND: int = Field(default=20, ge=1, le=100)
    RATE_LIMIT_BURST_SIZE: int = Field(default=50, ge=10, le=500)
    
    # =============================================================================
    # WEBHOOK SETTINGS
    # =============================================================================
    WEBHOOK_MAX_BODY_SIZE: int = Field(default=10 * 1024 * 1024)  # 10MB
    
    # =============================================================================
    # MINIO CONFIGURATION
    # =============================================================================
    MINIO_ENDPOINT: str = Field(default="http://minio:9000")
    MINIO_ACCESS_KEY: str = Field(default="minioadmin")
    MINIO_SECRET_KEY: str = Field(default="minioadmin")
    MINIO_BUCKET: str = Field(default="whatsapp-media")
    
    # =============================================================================
    # OBSERVABILITY CONFIGURATION
    # =============================================================================
    ENABLE_METRICS: bool = Field(default=True)
    ENABLE_TRACING: bool = Field(default=True)
    OTEL_EXPORTER_OTLP_ENDPOINT: str = Field(default="http://tempo:4317")
    
    @field_validator("DATABASE_URL_PRIMARY", "DATABASE_URL_REPLICA", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure DATABASE_URL uses asyncpg driver."""
        if v and not v.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use postgresql+asyncpg:// scheme")
        return v
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL from components."""
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Allow extra env vars without validation errors


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance to avoid repeated env parsing.
    
    The lru_cache decorator ensures this is only evaluated once per process,
    improving performance and ensuring consistent configuration.
    """
    return Settings()


# Global settings instance for import convenience
settings: Settings = get_settings()
