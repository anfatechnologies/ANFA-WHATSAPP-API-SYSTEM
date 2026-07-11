# /backend/app/core/database.py
# ANFA Database Layer - Async PostgreSQL with SQLAlchemy 2.0
# Provides connection pooling, session management, and engine lifecycle.

import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

# =============================================================================
# ENGINE CONFIGURATION
# =============================================================================

class DBManager:
    def __init__(self):
        self.primary_engine = None
        self.replica_engine = None
        self.primary_session_factory = None
        self.replica_session_factory = None

    def init(self):
        self.primary_engine = create_async_engine(
            settings.DATABASE_URL_PRIMARY,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=True,
            echo=settings.DEBUG,
            future=True,
        )
        self.replica_engine = create_async_engine(
            settings.DATABASE_URL_REPLICA,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=True,
            echo=settings.DEBUG,
            future=True,
        )
        
        self.primary_session_factory = async_sessionmaker(
            bind=self.primary_engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
        self.replica_session_factory = async_sessionmaker(
            bind=self.replica_engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )

    async def close(self):
        if self.primary_engine:
            await self.primary_engine.dispose()
        if self.replica_engine:
            await self.replica_engine.dispose()

db_manager = DBManager()

# =============================================================================
# PUBLIC API
# =============================================================================

def get_engine(read_only: bool = False):
    """Return the configured async engine instance."""
    return db_manager.replica_engine if read_only else db_manager.primary_engine


async def init_database() -> None:
    """Initialize database connection and verify connectivity.
    
    Called during application startup to ensure database is reachable.
    """
    db_manager.init()
    from app.models.schema import Base
    async with db_manager.primary_engine.begin() as conn:
        # Create all tables if they don't exist
        # In production, use Alembic migrations instead
        await conn.run_sync(Base.metadata.create_all)


async def close_database() -> None:
    """Gracefully close all database connections.
    
    Called during application shutdown to prevent connection leaks.
    """
    await db_manager.close()


@asynccontextmanager
async def get_db_session(read_only: bool = False) -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session with automatic commit/rollback.
    
    Usage:
        async with get_db_session(read_only=True) as session:
            result = await session.execute(query)
    
    Automatically commits on successful exit if not read_only, rolls back on exception.
    """
    factory = db_manager.replica_session_factory if read_only else db_manager.primary_session_factory
    session: AsyncSession = factory()
    try:
        yield session
        if not read_only:
            await session.commit()
    except Exception:
        if not read_only:
            await session.rollback()
        raise
    finally:
        await session.close()


async def get_db(read_only: bool = False) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database session injection.
    
    Usage in route handlers:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with get_db_session(read_only=read_only) as session:
        yield session


def generate_uuid() -> uuid.UUID:
    """Generate a new UUID primary key."""
    return uuid.uuid4()
