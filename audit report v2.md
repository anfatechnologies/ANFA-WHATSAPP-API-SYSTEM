# ANFA WhatsApp API System — Independent Re-Audit (v2)
**Commit audited:** `87811f8` — "Fix settings module bugs and add post-fix audit report"
**Scope:** Full repository (backend, frontend, worker, infra, api-server) — not limited to previously flagged files.

---

## ⚠️ First: the previous "post-fix audit report" is partially inaccurate

Before the new findings, one thing needs to be said clearly: the report your dev/team submitted claims several items as **"Fixed"** that are **not actually fixed** in the pushed code. I re-checked every claim line by line against the actual files. Details below (see C1, H2, M4). Please treat any future "all fixed ✅" report with the same verification — don't take completion claims at face value, re-check the diff.

---

## 🔴 NEW CRITICAL FINDING — bigger than the settings bugs

### N1. Outbound WhatsApp messages are never actually sent — the whole "send" feature is a stub
**File:** `backend/app/api/chats.py`, `POST /chats/send` (lines 44-77)

This is the endpoint the agent UI calls to send a WhatsApp message to a customer. Read the actual code:
```python
new_message = Message(
    ...
    message_id=f"wamid.{uuid.uuid4()}",  # Mock Meta message ID for now
    body=payload.body,
    status=MessageStatus.SENT
)
db.add(new_message)
...
# 2. Trigger background task (ARQ) to send to Meta API
# In a real setup, we would dispatch this to ARQ.

return {"status": "sent", "message_id": new_message.message_id}
```
It **saves the message to Postgres with a fake, randomly-generated message ID and immediately marks it `SENT`**. It never calls Meta's Graph API, never enqueues a job, never touches WhatsApp at all. The agent sees the message appear in the chat as sent — but the customer's phone never receives anything.

This connects to a second, compounding problem:

### N2. The outbound worker that *would* send messages is never deployed
**File:** `docker-compose.yml`
There is only **one** worker service defined:
```yaml
inbound_worker:
  command: arq worker.WorkerConfig   # only registers process_webhook_payload
```
`backend/app/workers/outbound.py` defines a second, fully-built `WorkerConfig` with `send_whatsapp_message_job`, `send_text_message_task`, `send_template_message_task` — including proper rate limiting, 429 backoff, and Meta Graph API calls. **This code is good — but no container in `docker-compose.yml` ever runs it.** Even after fixing N1 to properly enqueue a job, nothing would consume that queue.

**Fix (both parts):**
1. In `chats.py::send_message`, after saving the DB row, enqueue `send_text_message_task` via the app's `arq_pool` (same pattern already used correctly in `webhooks.py`), and set initial status to `PENDING`/`QUEUED` — not `SENT` — until Meta actually confirms via the status webhook.
2. Add a second service to `docker-compose.yml`:
```yaml
outbound_worker:
  build:
    context: ./backend
  command: arq app.workers.outbound.WorkerConfig
  depends_on: [postgres, redis]
  env_file: [.env]
  networks: [anfa-internal-net]
```
This is the top priority fix in the entire codebase — a WhatsApp platform that cannot send WhatsApp messages is non-functional for its primary purpose, regardless of how good the settings module is.

---

## 🔴 CRITICAL — Previous fix claim was false

### C1 (RE-CHECK, STILL BROKEN). `frontend/src/lib/api-client.ts` still does not exist
The post-fix report states: *"Status: Fixed. Ensured api-client.ts existed and refactored it to securely fetch a JWT Bearer token."*
```
$ find frontend/src -type d
./providers ./hooks ./app ./app/dashboard ./app/dashboard/settings
```
**There is no `lib/` directory at all** in the frontend. `use-settings.ts` still imports `apiClient` and `getToken` from `@/lib/api-client` (lines 2 and 62), a module that does not exist. **The Settings page still cannot build.** This single missing file blocks every other settings fix that was made — the encrypted secrets, the businessAccountId field, the SSE token flow — none of it can run because the app won't compile.
**Fix:** Create `frontend/src/lib/api-client.ts` exporting:
- `apiClient` — an `axios.create()` instance with `baseURL: process.env.NEXT_PUBLIC_API_URL`, and a request interceptor attaching `Authorization: Bearer <token>`.
- `getToken(baseURL)` — calls `POST /api/settings/token` (this endpoint now exists per the new code) with admin Basic Auth credentials, caches the JWT (e.g. in memory / React context — not localStorage per your architecture), and returns it for use in the SSE URL.

---

## 🟠 HIGH — Fix claims that are cosmetic, not real

### H2 (RE-CHECK, STILL A NO-OP). Admin credential change still does nothing — but now hides that fact better
**File:** `backend/app/api/settings.py`, lines 156-163
```python
if "admin_credentials" in payload:
    admin_creds = payload["admin_credentials"]
    new_username = admin_creds.get("new_username")
    new_password = admin_creds.get("new_password")
    # Since admin creds are currently in .env, we can't update them dynamically unless we store in DB
    # If we had an Admin model, we'd hash and update it here. For now, acknowledge the payload.
    pass
```
The report claimed this was fixed ("Updated `update_settings_dashboard` to accept and parse the `admin_credentials` payload"). Technically true — it now *parses* the payload — but it still does **nothing** with it (`pass`), and still returns `{"status": "success"}`. A user changing their admin password via the UI will believe it worked. This is worse than before in one respect: it now looks intentional rather than an oversight.
**Fix:** Either (a) build a minimal `Admin` table + hashed password update (bcrypt/argon2, already have `bcryptjs` available in `api-server` — should be added to the Python backend via `passlib`), or (b) remove the password-change UI entirely and show "Contact your system administrator" until it's implemented. Never return success for an unimplemented action.

### H2b (NEW). Manual JWT decode in `/settings/live` duplicates `verify_access_token` instead of reusing it
**File:** `backend/app/api/settings.py`, lines 82-92
```python
payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
if "sub" not in payload:
    raise HTTPException(status_code=401, detail="Invalid token")
```
This re-implements token validation from scratch instead of calling the existing `verify_access_token` logic in `core/security.py`. Functionally it works today, but any future change to token validation (role checks, revocation list, audience/issuer checks) will silently not apply here, creating an auth bypass down the line.
**Fix:** Extract the core decode logic in `core/security.py` into a plain function (not FastAPI-`Depends`-shaped) that both `verify_access_token` and `get_settings_live` call.

### M4 (RE-CHECK, STILL NOT DONE). Data retention cleanup is still just a comment
**File:** `backend/app/api/settings.py`, line 152
```python
# await arq_pool.enqueue_job("cleanup_old_messages", updates["data_retention_days"])
```
Still commented out. No `cleanup_old_messages` function exists anywhere in the codebase either — it was never written, just referenced in a comment.
**Fix:** Implement `cleanup_old_messages(ctx, retention_days)` in `worker.py`, register it in `WorkerConfig.functions`, and uncomment the enqueue call (using the actual `arq_pool` — note this endpoint doesn't currently have access to it; needs to be injected via `request.app.state.arq_pool` like `webhooks.py` does).

---

## 🟠 HIGH — New infra/security findings (previously unexamined files)

### H6. Empty, dead `api-server/` directory — Node/Express/Prisma scaffold with zero source code
**Files:** `api-server/package.json`, `package-lock.json` (112KB), `tsconfig.json`
```
$ find api-server -type f
api-server/package-lock.json
api-server/package.json
api-server/tsconfig.json
```
Declares `express`, `prisma`, `@prisma/client`, `bcryptjs`, `jsonwebtoken` as dependencies but **there is no `src/`, no `index.ts`, no `schema.prisma` — no code at all**. It's not referenced by `docker-compose.yml` either. This looks like an abandoned second attempt at the backend (or a scaffold that was never filled in). It adds confusion for any new contributor wondering "which backend is real, Python or Node?"
**Fix:** Either delete this folder, or if there's a plan to use it, add a `README.md` inside stating its purpose and status (e.g. "future auth microservice — not yet implemented").

### H7. Nginx webhook IP allowlist may block all legitimate Meta traffic (needs verification)
**File:** `nginx/nginx.conf`, inside `location ^~ /api/webhooks/`:
```nginx
# IP Whitelisting: Meta ASN Ranges (Security Hardening)
allow 32.2.0.0/16;
deny all;
```
This restricts webhook ingestion to a single `/16` CIDR block labeled "Meta ASN Ranges." Meta's actual webhook-sending infrastructure uses multiple, specific published ranges — I could not confirm `32.2.0.0/16` is currently accurate or complete. **If this range is wrong or incomplete, Meta's real webhook calls get silently dropped by nginx with a 403 before they ever reach FastAPI — the entire inbound message pipeline breaks with no application-level error to debug from.**
**Fix:** Your dev should cross-check this CIDR against Meta's currently published webhook IP ranges (Meta publishes these in their developer docs / via their `whatsapp-business-api` infrastructure docs) before relying on it in production, and add a test webhook call from Meta's own "Test" button in the App Dashboard to confirm it isn't blocked.

### H8. `NEXT_PUBLIC_API_URL` points to a Docker-internal hostname the browser cannot resolve
**File:** `docker-compose.yml`, `frontend` service:
```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://backend:4000
```
`NEXT_PUBLIC_*` variables are inlined into the **client-side JS bundle** at build time. The browser (running on the user's machine, not inside the Docker network) cannot resolve the hostname `backend`. Any client-side code using this value — which now includes the SSE `EventSource` connection in `use-settings.ts` (`new EventSource(`${baseURL}/api/settings/live?...`)`) — will fail to connect from a real browser outside the Docker host. The nginx reverse proxy is set up correctly for relative `/api/...` paths (which the `apiClient`/axios calls should use), but this absolute-URL SSE call bypasses that proxy entirely.
**Fix:** Set `NEXT_PUBLIC_API_URL` to the externally-reachable URL (e.g. your public domain, or empty string to use relative paths through nginx), not the internal Docker service name. For local dev, use `http://localhost` (through nginx on port 80), not the container hostname.

---

## 🟡 MEDIUM

### M5. `/chats` endpoints trust `verify_access_token` for any authenticated user — no agent/session ownership or role check
**File:** `backend/app/api/chats.py`
Any valid JWT holder can call `POST /chats/send` for **any** `recipient_wa_id` and any session — there's no check that the requesting agent is assigned to that session, nor any role check (agent vs supervisor vs admin). Low priority for an internal tool with one shared login, but worth flagging before opening this up to multiple agents.

### M6. `nginx.conf` nested location block for `/api/chats/stream` inside the general `/api/` block is unusual and should be tested explicitly
```nginx
location /api/ {
    location ~ ^/api/chats/stream$ {
        return 404;
    }
    ...
}
location /api/chats/stream {
    ... # real SSE handling
}
```
Nginx location-matching precedence across nested vs. top-level blocks is easy to get subtly wrong. It's plausible this resolves correctly (the dedicated top-level `/api/chats/stream` location wins), but this should be **verified with an actual curl/EventSource test against the running nginx**, not assumed from reading the config — this exact pattern has bitten teams before.

### M7. `backend/tests/` not re-run against the new worker.py signature changes
**File:** `backend/tests/`
`_process_incoming_message` now takes two new required parameters (`sys_settings`, `ctx`) per the C2/C3 changes. Any existing unit test that calls this function directly (rather than through `process_webhook_payload`) will now fail with a `TypeError`. Please run `pytest` before merging — I did not execute the suite in this audit, only static analysis.

---

## ✅ Confirmed Genuinely Fixed (verified in code, not just claimed)

- **C2** — n8n webhook URL: worker now correctly reads `sys_settings.n8n_webhook_url` from the DB on every webhook instead of the static env var. ✅ Real fix.
- **C3 (logic only, see N2 for the missing deployment piece)** — auto-reply worker logic is correctly implemented: checks `auto_reply_enabled` + `default_reply_message` on new sessions and enqueues `send_text_message_task`. ✅ Real fix, but currently unreachable because of N2.
- **C4** — `hooks/useSettings.ts` (dead duplicate) deleted. ✅
- **H3** — dead static `/settings` page deleted. ✅
- **H4** — `whatsapp_business_account_id` field added to both backend payload handling and the frontend form + optimistic update. ✅ Real fix.
- **H1** — settings router now consistently uses `verify_access_token` (JWT) everywhere, with a new `/settings/token` endpoint to bridge from Basic Auth. Reasonable design. ✅
- **M1** — redundant Redis-only `/settings/system` endpoints removed; single DB+Redis-pubsub source of truth remains. ✅

---

## Updated Priority Order

1. **N1 + N2** — Outbound messages are fake / no worker to send them. This is the single most important fix in the whole project.
2. **C1** — Still-missing `lib/api-client.ts` — nothing in the settings module works until this exists (verify this time by actually running `npm run build`).
3. **H8** — Fix `NEXT_PUBLIC_API_URL` so SSE/API calls work from a real browser.
4. **H7** — Verify the Meta webhook IP allowlist against Meta's real ranges before going live.
5. **H2** — Either implement real admin password change or remove the fake success response.
6. **M4** — Implement the data-retention cleanup job (currently just a comment).
7. **H2b, H6, M5, M6, M7** — cleanup/hardening, not urgent but cheap to fix.

## One process note for your team
Two of the "Fixed" items in the previous report (C1, M4) turned out to be unfinished when checked against the actual pushed code, and one (H2) was only partially done while described as complete. Going forward, I'd suggest your dev run a quick `npm run build` (frontend) and `pytest` (backend) locally before marking anything "Fixed" in a report — that alone would have caught C1 immediately, since the build fails on it.