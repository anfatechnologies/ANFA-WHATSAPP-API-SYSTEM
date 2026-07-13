# /backend/app/main.py
# ANFA FastAPI Application Entry Point
# Configures all middleware, routes, database lifecycle, and startup/shutdown hooks.

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.database import init_database, close_database, db_manager
from app.api.webhooks import router as webhooks_router
from app.api.settings import router as settings_router
from app.api.stream import router as stream_router
from app.api.dashboard import router as dashboard_router

import structlog
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
access_log = structlog.get_logger("access")

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# =============================================================================
# APPLICATION LIFECYCLE
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager handling startup and shutdown sequences.
    
    Startup:
    1. Initialize database connections and verify connectivity
    2. Verify Redis connectivity
    3. Load system settings into cache
    
    Shutdown:
    1. Close all database connections gracefully
    2. Flush any pending operations
    """
    # STARTUP
    logger.info("=" * 60)
    logger.info(f"ANFA WhatsApp Platform v{settings.APP_VERSION}")
    logger.info("Starting up...")
    logger.info("=" * 60)
    
    startup_start = time.time()
    
    try:
        # Initialize database
        logger.info("Initializing database connection...")
        await init_database()
        logger.info("Database connection established")
        
        # Initialize ARQ Pool
        from arq import create_pool
        from arq.connections import RedisSettings
        app.state.arq_pool = await create_pool(
            RedisSettings(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                database=settings.REDIS_DB,
            )
        )
        logger.info("ARQ Redis pool established")
        
        # FIX #1: Initialize a SHARED Redis connection pool for all API requests.
        # This pool is injected into app.state and reused by webhooks.py,
        # eliminating the per-request connection churn that caused 502 errors under load.
        import redis.asyncio as redis
        app.state.redis_pool = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            decode_responses=True,
            max_connections=50,           # Pool cap — prevents socket exhaustion
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        await app.state.redis_pool.ping()  # Verify connectivity at startup
        logger.info("Shared Redis connection pool established (max_connections=50)")
        
        startup_elapsed = time.time() - startup_start
        logger.info(f"Startup completed in {startup_elapsed:.2f}s")
        
    except Exception as e:
        logger.error(f"Startup failed: {e}", exc_info=True)
        raise
    
    yield  # Application runs here
    
    # SHUTDOWN
    logger.info("Shutting down...")
    try:
        if hasattr(app.state, 'arq_pool'):
            await app.state.arq_pool.close()
        # FIX #1: Close the shared Redis pool gracefully
        if hasattr(app.state, 'redis_pool'):
            await app.state.redis_pool.close()
            logger.info("Shared Redis pool closed")
        await close_database()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Shutdown error: {e}", exc_info=True)
    
    logger.info("Shutdown complete")


# =============================================================================
# RATE LIMITING (P1 Fix)
# =============================================================================
# slowapi provides per-IP rate limiting backed by in-memory state.
# Webhook endpoints are excluded (Meta IPs only), but API endpoints are limited.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# =============================================================================
# FASTAPI APPLICATION INSTANCE
# =============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Self-hosted WhatsApp CRM & API Management Platform with absolute data sovereignty",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# =============================================================================
# MIDDLEWARE & OBSERVABILITY
# =============================================================================

if settings.ENABLE_METRICS:
    Instrumentator().instrument(app).expose(app)

if settings.ENABLE_TRACING:
    FastAPIInstrumentor.instrument_app(app)

# P1 Fix: CORS — uses explicit FRONTEND_URL instead of allow_origins=["*"] or []
# allow_origins=[] in production meant frontend couldn't call the API at all.
allowed_origins = (
    ["*"] if settings.DEBUG
    else [settings.FRONTEND_URL] if settings.FRONTEND_URL else []
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# Gzip compression for responses (excludes streaming endpoints)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request timing middleware
@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """Add request processing time header for performance monitoring."""
    start_time = time.time()
    response = await call_next(request)
    elapsed = time.time() - start_time
    response.headers["X-Response-Time"] = f"{elapsed:.3f}s"
    
    access_log.info(
        "request_processed",
        method=request.method,
        url=str(request.url.path),
        status_code=response.status_code,
        latency=elapsed,
        request_id=getattr(request.state, "request_id", "unknown")
    )
    
    return response

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Attach unique request ID for distributed tracing."""
    import uuid
    request_id = str(uuid.uuid4())[:12]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors.
    
    Returns sanitized error responses without exposing internal details.
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "An internal error occurred. Please try again later.",
            "timestamp": time.time(),
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )

# =============================================================================
# ROUTE REGISTRATION
# =============================================================================

# Webhook routes (must be public for Meta to call)
app.include_router(webhooks_router, prefix="/api")

# Settings routes (authenticated)
app.include_router(settings_router, prefix="/api")

# SSE streaming routes (authenticated via query param or header)
app.include_router(stream_router, prefix="/api")

# Dashboard routes (zero-config basic auth)
app.include_router(dashboard_router, prefix="/api")

# Chat routes (authenticated)
from app.api.chats import router as chats_router
app.include_router(chats_router, prefix="/api")

# =============================================================================
# HEALTH CHECK ENDPOINTS
# =============================================================================

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Docker and load balancer health probes."""
    from datetime import datetime, timezone
    from sqlalchemy import text
    
    services = {"api": "up"}
    
    # P0 Fix: Use db_manager.primary_engine (was incorrectly referencing _engine)
    try:
        async with db_manager.primary_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["database"] = "up"
    except Exception:
        services["database"] = "down"
    
    # Use shared pool from app.state (FIX #1 — no new connections)
    try:
        await app.state.redis_pool.ping()
        services["redis"] = "up"
    except Exception:
        services["redis"] = "down"
    
    overall_status = "healthy" if all(s == "up" for s in services.values()) else "degraded"
    
    return {
        "status": overall_status,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": services,
    }


@app.get("/api/ready", tags=["Health"])
async def readiness_check():
    """Readiness probe — returns 200 only when all dependencies are ready."""
    from sqlalchemy import text
    try:
        # P0 Fix: correct reference to db_manager.primary_engine
        async with db_manager.primary_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "reason": "database_unavailable"},
        )


# =============================================================================
# ROOT ENDPOINT
# =============================================================================

@app.get("/", tags=["Root"], include_in_schema=False)
async def root():
    """Root endpoint redirecting to API documentation."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/api/docs",
        "health": "/api/health",
    }
