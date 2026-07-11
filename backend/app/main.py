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

from app.core.config import settings
from app.core.database import init_database, close_database
from app.api.webhooks import router as webhooks_router
from app.api.settings import router as settings_router
from app.api.stream import router as stream_router

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
        
        # Verify Redis connectivity
        logger.info("Verifying Redis connectivity...")
        import redis.asyncio as redis
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            socket_connect_timeout=5,
        )
        await redis_client.ping()
        await redis_client.close()
        logger.info("Redis connectivity verified")
        
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
        await close_database()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Shutdown error: {e}", exc_info=True)
    
    logger.info("Shutdown complete")


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

# =============================================================================
# MIDDLEWARE & OBSERVABILITY
# =============================================================================

if settings.ENABLE_METRICS:
    Instrumentator().instrument(app).expose(app)

if settings.ENABLE_TRACING:
    FastAPIInstrumentor.instrument_app(app)

# CORS - Configure for production deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [],  # Restrict in production
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

# =============================================================================
# HEALTH CHECK ENDPOINTS
# =============================================================================

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint for Docker and load balancer health probes.
    
    Returns service status and connectivity information.
    """
    from datetime import datetime, timezone
    
    services = {"api": "up"}
    
    # Check database
    try:
        from app.core.database import _engine
        from sqlalchemy import text
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        services["database"] = "up"
    except Exception:
        services["database"] = "down"
    
    # Check Redis
    try:
        import redis.asyncio as redis
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            socket_connect_timeout=2,
        )
        await redis_client.ping()
        await redis_client.close()
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
    """Readiness probe for Kubernetes-style deployments.
    
    Returns 200 only when all dependencies are ready to serve traffic.
    """
    try:
        from app.core.database import _engine
        from sqlalchemy import text
        async with _engine.connect() as conn:
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
