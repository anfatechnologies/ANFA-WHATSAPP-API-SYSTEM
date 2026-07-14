\# ANFA WhatsApp API System

An open-source, self-hosted WhatsApp Business API platform. Send and receive WhatsApp messages, automate replies, integrate with n8n, and manage everything from a web dashboard — all running on your own infrastructure.

**Stack:** FastAPI (backend) · Next.js (frontend) · PostgreSQL · Redis · arq (background workers) · Docker Compose · Nginx

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker — recommended)](#quick-start-docker--recommended)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Manual / Local Development Setup (without Docker)](#manual--local-development-setup-without-docker)
5. [Verifying Your Setup Actually Works](#verifying-your-setup-actually-works)
6. [Architecture Overview](#architecture-overview)
7. [Settings Module](#settings-module)
8. [Troubleshooting / Common Errors](#troubleshooting--common-errors)
9. [Running Tests](#running-tests)
10. [Contributing](#contributing)
11. [License](#license)

---

## Prerequisites

Before you start, make sure you have:

- **Docker** and **Docker Compose** (v2+) — [install guide](https://docs.docker.com/get-docker/)
- **Git**
- A **Meta Developer account** with a WhatsApp Business API app set up (App ID, App Secret, a Phone Number ID, a WhatsApp Business Account ID, and a permanent access token). See [Meta's official WhatsApp Cloud API get-started guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) if you don't have this yet.
- (Optional, for automation) An [n8n](https://n8n.io/) instance if you want to use the automation/auto-reply features beyond the basics.
- (Optional, for local dev without Docker) Python 3.11+, Node.js 20+, PostgreSQL 16, Redis 7.

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone the repo
git clone https://github.com/anfatechnologies/ANFA-WHATSAPP-API-SYSTEM.git
cd ANFA-WHATSAPP-API-SYSTEM

# 2. Create your .env file from the template
cp .env.example .env

# 3. Edit .env and fill in EVERY value — see the full reference table below.
#    Do not skip any variable marked "REQUIRED" or the containers will
#    refuse to start (this is intentional — see the security note below).
nano .env    # or use any editor you like

# 4. Build and start everything
docker compose up --build -d

# 5. Watch the logs to confirm everything started cleanly
docker compose logs -f
```

Once running:
- **Dashboard:** http://localhost (served through nginx)
- **Backend API directly:** http://localhost:8000 (if you need to hit it without the proxy)
- **Health check:** http://localhost:8000/api/health should return `{"status": "ok"}`

To stop everything:
```bash
docker compose down
```

To stop and wipe all data (Postgres/Redis volumes — **destructive**):
```bash
docker compose down -v
```

---

## Environment Variables Reference

All of these go in your `.env` file at the repo root (copy `.env.example` first). **Every variable below with no default in `backend/app/core/config.py` is required — the backend will refuse to start (loudly, with a clear Pydantic validation error) if any of these are missing.** This is intentional: it's safer for the app to fail to start than to silently run with an insecure default.

| Variable | Required? | Description |
|---|---|---|
| `DB_PASSWORD` | ✅ Required | Password for the Postgres user created inside the `postgres` container. |
| `REDIS_PASSWORD` | ✅ Required | Password for the Redis container. |
| `SECRET_KEY` | ✅ Required (min 32 chars) | Used to sign JWTs. Generate one with `openssl rand -hex 32`. |
| `ENCRYPTION_MASTER_KEY` | ✅ Required (min 32 chars) | AES-256-GCM key used to encrypt sensitive data at rest (access tokens, app secrets, message bodies). Generate with `openssl rand -hex 16` (needs to resolve to 32 bytes). **Never reuse the key from any example/docs — generate your own.** |
| `ADMIN_USERNAME` | ✅ Required | Username for the single admin account (this project currently uses a single shared admin login, not per-user accounts). |
| `ADMIN_PASSWORD` | ✅ Required | Password for the admin account. Use a strong, unique password — this protects your Settings page and Meta credentials. |
| `NEXT_PUBLIC_API_URL` | Optional (default: empty string) | Leave empty to use relative paths through nginx (recommended, works out of the box). Only set this to an absolute URL (e.g. `https://your-domain.com`) if you're not using the bundled nginx reverse proxy. |
| `N8N_WEBHOOK_URL` | Optional | Default n8n automation webhook, if you're using n8n integration. This can also be changed later from the Settings UI without restarting containers. |

> **Note on `NEXT_PUBLIC_*` variables:** these are inlined into the frontend's JavaScript bundle at **build time**, not runtime. If you change any `NEXT_PUBLIC_*` value in `.env` after already building the images, you must rebuild the frontend: `docker compose build frontend && docker compose up -d frontend`. Just restarting the container is not enough.

You do **not** need to set `DATABASE_URL_PRIMARY` / `DATABASE_URL_REPLICA` / `NEXT_PUBLIC_ADMIN_USERNAME` / `NEXT_PUBLIC_ADMIN_PASSWORD` yourself — `docker-compose.yml` constructs these automatically from `DB_PASSWORD` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` above.

Once the containers are running, go to the **Settings** page in the dashboard to configure your actual WhatsApp/Meta credentials (Business Account ID, Phone Number ID, App Secret, Access Token) — these are stored encrypted in the database, not in `.env`.

---

## Manual / Local Development Setup (without Docker)

Useful if you're actively developing and want faster reload cycles than rebuilding containers each time.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Export all required env vars (see table above), e.g.:
export DATABASE_URL_PRIMARY="postgresql+asyncpg://user:pass@localhost:5432/anfa_db"
export DATABASE_URL_REPLICA="postgresql+asyncpg://user:pass@localhost:5432/anfa_db"
export SECRET_KEY="$(openssl rand -hex 32)"
export ENCRYPTION_MASTER_KEY="$(openssl rand -hex 16)"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="change-me"

# Make sure Postgres and Redis are running locally first, then:
uvicorn app.main:app --reload --port 8000
```

In a second terminal, run the inbound worker:
```bash
cd backend
source venv/bin/activate
arq worker.WorkerConfig
```

In a third terminal, run the outbound worker (this is what actually sends messages to Meta — the app cannot send WhatsApp messages without this running):
```bash
cd backend
source venv/bin/activate
arq app.workers.outbound.WorkerConfig
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000.

---

## Verifying Your Setup Actually Works

Don't just assume containers being "up" means everything works — verify explicitly:

```bash
# 1. All containers running and healthy?
docker compose ps
# Every service should show "Up" / "healthy" — if anything shows
# "Restarting" repeatedly, it's crash-looping. Check its logs:
docker compose logs <service-name>

# 2. Backend actually responds?
curl http://localhost:8000/api/health

# 3. Can the backend import cleanly (catches config/dependency issues fast)?
docker compose exec backend python -c "import app.main; print('OK')"
docker compose exec inbound_worker python -c "import worker; print('OK')"
docker compose exec outbound_worker python -c "import app.workers.outbound; print('OK')"

# 4. Frontend actually built and is serving pages?
curl -I http://localhost
```

If you configure a Meta webhook, use the **"Test"** button in the Meta App Dashboard (WhatsApp → Configuration) to send a test payload and confirm it reaches your server — check `docker compose logs backend` for a log line showing it was received and processed.

---

## Architecture Overview

```
                    ┌─────────────┐
   Meta Cloud API ──▶   Nginx    │──▶ Frontend (Next.js)
   (webhooks)          (reverse   │
                        proxy)    │──▶ Backend (FastAPI)
                    └─────────────┘         │
                                             ├──▶ PostgreSQL (messages, contacts, settings)
                                             ├──▶ Redis (cache, pub/sub, job queue)
                                             │
                                    ┌────────┴────────┐
                                    │                 │
                         inbound_worker         outbound_worker
                    (processes incoming      (sends messages to
                     webhook payloads,         Meta Graph API,
                     auto-reply logic)         rate-limit aware)
                                    │
                                    └──▶ n8n (optional automation)
```

- **Inbound flow:** Meta sends a webhook → nginx → backend validates the signature → enqueues a job → `inbound_worker` processes it (saves message, triggers n8n/auto-reply if configured).
- **Outbound flow:** Agent sends a message from the dashboard → backend saves it as `QUEUED` → enqueues a job → `outbound_worker` calls Meta's Graph API (with rate-limit backoff) → updates message status.
- **Both workers must be running** for the system to function — the backend API alone cannot send or fully process messages.

---

## Settings Module

Accessible from the dashboard's **Settings** page (admin login required). Changes here take effect without restarting any container — they're read dynamically from the database/Redis by the workers.

| Setting | What it does |
|---|---|
| WhatsApp Business Account ID, Phone Number ID, Access Token, App Secret | Your Meta credentials — stored encrypted (AES-256-GCM) in the database. |
| n8n Webhook URL | Where inbound message events get forwarded for automation, if you use n8n. |
| Auto-Reply (toggle + message) | When enabled, automatically sends the given message to new conversations. |
| Data Retention (days) | Automatically purges messages/logs older than this many days (runs as a background job when changed). |
| Admin Credentials | Change the dashboard admin username/password. |

> **Roadmap / not yet implemented:** Appearance preferences (theme, language, notification sound) and Encryption Key Rotation are planned but not yet built — if you see UI stubs for these, they are not functional yet. Contributions welcome.

---

## Troubleshooting / Common Errors

### `pydantic_core._pydantic_core.ValidationError: ... Field required`
You're missing a required environment variable. Check the [Environment Variables Reference](#environment-variables-reference) table above — every variable marked "Required" must be set in `.env` with no typos in the name.

### Backend container keeps restarting / `NameError` or `NoneType is not callable` in logs
Run the container's Python import directly to see the real traceback instead of guessing from a crash loop:
```bash
docker compose exec backend python -c "import app.main"
```
This will print the exact line and error. Common causes we've hit in this repo before:
- A missing pip package not listed in `requirements.txt` (check the exact submodule you're importing exists in the package you think it does — some libraries split submodules across multiple PyPI packages).
- A SQLAlchemy model using a column name that collides with a reserved attribute (e.g. a column literally named `metadata`).

### `ModuleNotFoundError` for a package you're sure is installed
Rebuild the image without cache — Docker layer caching can serve a stale `pip install` layer if `requirements.txt` changed but the cache wasn't invalidated:
```bash
docker compose build --no-cache backend
```

### Settings saved in the UI don't seem to do anything / don't persist
1. Confirm the save actually returned success (check the browser's Network tab, not just the toast message — a `200 {"status": "success"}` response doesn't always mean the field was actually handled, if the backend doesn't recognize that field name).
2. Confirm the relevant worker is actually running: `docker compose ps` — if `inbound_worker` or `outbound_worker` isn't listed as "Up", that setting's effect (auto-reply, sending messages) won't happen even though it saved correctly.
3. Some settings are read fresh on every use (e.g. n8n webhook URL) — no restart needed. If something isn't reflecting, it may not be wired to the runtime yet — check this README's Settings Module table above for what's actually implemented vs. planned.

### Messages show as "sent" in the dashboard but never arrive on WhatsApp
Check `docker compose logs outbound_worker` — this container is what actually calls Meta's Graph API. If it's not running, or its logs show an authentication error, your Access Token / Phone Number ID in Settings may be wrong or expired. Also check you haven't hit Meta's rate limit (look for HTTP 429s in the logs).

### Webhooks from Meta aren't arriving at all
1. Use the **"Test"** button in Meta App Dashboard → WhatsApp → Configuration to send a test payload and see if it's rejected.
2. Check `nginx` logs for a `403` — this repo's nginx config allowlists Meta's known webhook IP ranges. If Meta has rotated their IPs since this was last verified, you may need to update the allowlist (see the comment above the `allow` list in `nginx/nginx.conf` for how to get the current list via `whois`), or switch to relying on payload signature verification alone.
3. Make sure your app is in **Live** mode in the Meta dashboard — some webhook fields aren't sent while in Dev mode.

### `npm run build` fails with `Cannot find module '@/lib/...'`
Make sure you ran `npm install` (or `npm ci`) after the latest `git pull` — new files sometimes come with new dependencies. If the module genuinely doesn't exist, check `git status --ignored` — this repo previously had a `.gitignore` bug where a generic `lib/` pattern silently excluded `frontend/src/lib/` from every commit. If you're missing a file that should exist, verify it isn't being accidentally gitignored:
```bash
git check-ignore -v frontend/src/lib/<the-missing-file>
```

### GitHub Actions CI fails instantly on every job (a few seconds each)
This usually isn't a code problem — check for:
1. **Billing/account lock** — click into the failed job and expand "Annotations" at the bottom of the run summary; a message like *"The job was not started because your account is locked due to a billing issue"* means you need to resolve billing at `github.com/settings/billing` (or your organization's billing page) before any workflow can run, regardless of code correctness.
2. **Actions permissions** — Settings → Actions → General → confirm "Allow all actions and reusable workflows" (or an equivalent that permits the actions this repo's workflows use: `actions/checkout`, `actions/setup-python`, `actions/setup-node`, `codecov/codecov-action`, `trufflesecurity/trufflehog`).

### `passlib`/`bcrypt` errors during password hashing
`passlib[bcrypt]==1.7.4` is incompatible with `bcrypt>=4.1` (a breaking change removed an attribute passlib's version-detection relies on). This repo pins `bcrypt==4.0.1` in `requirements.txt` for exactly this reason — if you've manually upgraded bcrypt, downgrade it back.

### Docker build succeeds but `NEXT_PUBLIC_*` values seem wrong/empty in the running app
These variables are inlined at **build time**. Setting them only in `docker-compose.yml`'s `environment:` block (which is runtime-only) has no effect — they must be passed via `build.args:` in `docker-compose.yml` and declared with `ARG`/`ENV` in `frontend/Dockerfile` before the `RUN npm run build` step. If you've customized the Dockerfile, make sure this wiring is intact.

---

## Running Tests

```bash
cd backend
source venv/bin/activate   # if using a local venv
pip install pytest pytest-asyncio pytest-cov aiosqlite

# Make sure Postgres + Redis are reachable (via docker or locally),
# and all required env vars from the table above are set, then:
pytest -v --cov=app --cov-report=term-missing
```

Frontend:
```bash
cd frontend
npx tsc --noEmit    # type check
npm run build       # full production build check
```

---

## Contributing

Issues and pull requests are welcome. A few things to keep in mind:

- Before opening a PR, please actually run the app (`docker compose up --build`) and confirm it starts cleanly, plus run the test commands above — a PR that "looks correct" but hasn't been executed has caused real regressions in this project before.
- The landing page (`frontend/src/app/page.tsx`) and its branding elements are protected by a CI check (`.github/workflows/branding-protection.yml`) — see `LICENSE` for the attribution requirement.
- If you're adding a new Settings field, make sure it's wired all the way through: DB column → API schema → endpoint handling → frontend form → frontend request payload → actually consumed by a worker/endpoint at runtime. A setting that only gets saved to the database but is never read anywhere is not considered done.

---

## License

See [LICENSE](./LICENSE). Includes an attribution clause requiring ANFA branding/credit to be retained in redistributions of the landing page.