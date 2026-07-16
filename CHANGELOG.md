# Changelog

All notable changes to ANFA WhatsApp Platform are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `N8N_WEBHOOK_URL` config: Every inbound message is now dispatched to a self-hosted n8n automation workflow
- n8n container added to `docker-compose.yml` with persistent volume and `Asia/Karachi` timezone
- Shared Redis connection pool on `app.state.redis_pool` (eliminates connection churn)
- Idempotency check via Redis SETNX — duplicate Meta webhooks are now silently ignored
- PostgreSQL UPSERT (`INSERT ... ON CONFLICT`) for contact creation — eliminates race conditions
- `slowapi` rate limiting middleware: 200 requests/minute per IP on all API routes
- Alembic migration framework with `env.py` (async-compatible) and first migration `0001_initial_schema.py`
- `pytest` test suite: security module tests (password hashing, JWT, HMAC signature verification)
- GitHub Actions CI pipeline: backend tests, Docker build, Next.js TypeScript + build, TruffleHog secret scanning
- `FRONTEND_URL` setting for explicit CORS origin control in production
- `CHANGELOG.md` — this file

### Changed
- Refactored landing page into modular components (`Navbar`, `HeroSection`, `Footer`, `3D`) for better maintainability
- Updated GitHub Actions branding protection workflow to scan all landing components instead of just `page.tsx`

### Fixed
- **P0 Bug**: Health check endpoints `/api/health` and `/api/ready` referenced non-existent `_engine` — now correctly use `db_manager.primary_engine`
- **P1 Bug**: CORS `allow_origins=[]` in production blocked all frontend requests — now uses `FRONTEND_URL` env var
- **P1 Bug**: `settings.py` API was creating new Redis connections per request — migrated to `app.state.redis_pool`

---

## [0.1.0] — 2026-07-11

### Added
- Initial project scaffold: FastAPI backend, Next.js frontend, Nginx, Docker Compose
- HMAC-SHA256 webhook signature verification with constant-time comparison
- ARQ-based async job queue for webhook processing
- PostgreSQL schema with native range partitioning for messages table
- Redis pub/sub for real-time message delivery to frontend via SSE
- MinIO / S3-compatible media storage integration
- JWT-based authentication for agent dashboard routes
- Per-phone-number credential isolation in Redis
- Prometheus + Grafana observability stack
- GPL-3.0 open source license
- `README.md`, `CONTRIBUTING.md`, `.gitignore`, `LICENSE`
