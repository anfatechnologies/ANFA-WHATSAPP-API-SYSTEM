# ANFA WhatsApp API System — Full Repository Audit
**Repo:** github.com/anfatechnologies/ANFA-WHATSAPP-API-SYSTEM
**Scope:** Backend (FastAPI), Frontend (Next.js), Worker, Settings Sync, Webhooks
**Audit date:** 2026-07-13

---

## Executive Summary

Backend infrastructure (webhooks, DB models, worker queueing, rate limiting, DLQ) is **well-engineered**. But the **Settings Module — exactly the area you asked me to focus on — is broken end-to-end**. Multiple settings changed from the UI either (a) never reach the backend at all due to a missing file, (b) reach the DB but are never read by the worker, or (c) are silently dropped by the API. The frontend also has two competing, contradictory implementations of the same feature — a strong sign of AI-agent-generated code that was never reconciled.

**Total issues found: 14** — 5 Critical, 5 High, 4 Medium.

---

## 🔴 CRITICAL — Breaks core functionality

### C1. Settings page cannot build/run — missing `lib/api-client.ts`
**File:** `frontend/src/hooks/use-settings.ts` (line 2)
```ts
import { apiClient } from '@/lib/api-client';
```
There is **no `lib/` folder anywhere in `frontend/src`**. This is the hook actually used by the live Settings page (`app/dashboard/settings/page.tsx`). This import will fail at build time (`Module not found`), or if somehow bypassed, will crash at runtime the moment the Settings page loads.
**Fix:** Create `frontend/src/lib/api-client.ts` — a thin `axios` instance (axios is already a dependency) with base URL from `NEXT_PUBLIC_API_URL` and an auth interceptor (see C3 for what auth scheme to standardize on).

### C2. Worker ignores the DB/Redis-stored settings — env var used instead
**File:** `backend/worker.py` (lines 79, 311)
```python
if message and settings.N8N_WEBHOOK_URL:   # <-- static env var
...
response = await http_client.post(settings.N8N_WEBHOOK_URL, ...)
```
The n8n Webhook URL that the user sets in the Settings UI is saved to `SystemSettings` table / Redis via `SettingsService`, but the **worker never reads it** — it always uses the `N8N_WEBHOOK_URL` environment variable set at container startup. This is precisely the bug you described: changing settings in the UI does not affect actual backend behavior. It directly contradicts the project's own spec (`prompt.txt`): *"loaded into worker.py context dynamically so changes take effect without restarting containers."*
**Fix:** On each webhook dispatch, fetch the current `n8n_webhook_url` from Redis (`SettingsService`/cached with short TTL) instead of `settings.N8N_WEBHOOK_URL`. Alternatively, subscribe the worker process to the `settings:updates` Redis pub/sub channel and cache the latest value in `ctx`.

### C3. Auto-Reply feature is completely dead — stored but never executed
**Fields:** `auto_reply_enabled`, `default_reply_message` (in `SystemSettings` model, exposed via API, editable in UI)
```
grep result: these fields are only ever *read from* or *written to* the settings API/service.
They are never referenced in worker.py, outbound.py, or anywhere in message-processing logic.
```
Toggling "Auto Reply" ON in the UI and saving a default message does **nothing** — no code path checks this flag or sends the message. This is a fully-specified feature (per `prompt.txt` item 2) that was never implemented past the settings form.
**Fix:** In `_process_incoming_message` (worker.py) or right after a message is enqueued, check the cached `auto_reply_enabled` flag; if true and no agent has responded, enqueue an outbound message using `default_reply_message`.

### C4. Two contradictory `useSettings` hooks — one is dead, confusing code
**Files:** `frontend/src/hooks/useSettings.ts` vs `frontend/src/hooks/use-settings.ts`
These two files:
- Have **different field names** (`default_agent_role`, `business_hours_start` vs `n8n_webhook_url`, `auto_reply_enabled`)
- Call **different backend endpoints** (`/settings/system` vs `/settings/` and `/settings/update`)
- Only `use-settings.ts` is actually imported anywhere (`app/dashboard/settings/page.tsx`)

`useSettings.ts` (capital-S filename) is 100% dead code that doesn't match anything in the current backend schema. This is a major source of developer confusion — anyone editing "the settings hook" has a 50% chance of editing the wrong, unused file.
**Fix:** Delete `hooks/useSettings.ts` entirely. Keep `use-settings.ts` as the single source of truth.

### C5. SSE live-sync (`/settings/live`) will always fail authentication
**File:** `frontend/src/hooks/use-settings.ts` (lines ~45-58)
```ts
const eventSource = new EventSource(`${baseURL}/api/settings/live`);
```
The backend endpoint `GET /settings/live` requires `verify_admin` → **HTTP Basic Auth**. The native browser `EventSource` API **cannot send custom headers or Basic Auth credentials**. The code even computes a base64 `b64` auth string and then never uses it (dead variable). Every SSE connection to this endpoint will get a `401/403` and silently fail — so the "instant settings sync without refresh" feature (the core spec requirement) does not work.
**Fix:** Either (a) pass a short-lived signed token as a query param that `verify_admin`/a new dependency accepts, or (b) switch to `@microsoft/fetch-event-source` (supports headers) instead of native `EventSource`, or (c) make `/settings/live` accept a `token` query param instead of Basic Auth.

---

## 🟠 HIGH — Silent failures / security gaps

### H1. Two authentication schemes mixed across the same settings router
**File:** `backend/app/api/settings.py`
- `GET/POST /settings/`, `/settings/update` → `verify_admin` (**HTTP Basic Auth**)
- `/settings/system`, `/settings/meta-credentials/*`, `/settings/phone-numbers/*` → `verify_access_token` (**Bearer JWT**)

One router, one feature area, two incompatible auth mechanisms. Any frontend client (including the one currently wired) has to juggle both, and most requests via `apiClient` (axios) almost certainly only attach one type of header — meaning several of these endpoints are likely returning 401 in practice.
**Fix:** Standardize on Bearer JWT (`verify_access_token`) everywhere in this router; drop Basic Auth for `/settings/` and `/settings/update`.

### H2. `admin_credentials` payload silently dropped by backend
**Files:** `frontend/.../dashboard/settings/page.tsx` (line 53) sends:
```ts
payload = { admin_credentials: { new_username, new_password } }
```
**Backend** `update_settings_dashboard` (`settings.py` lines 93-142) only handles `api_config`, `automation`, `privacy` — there is **no `if "admin_credentials" in payload"` branch at all**. The endpoint still returns `{"status": "success"}`, so the user sees a success toast while their password/username change is completely ignored.
**Fix:** Add explicit handling for `admin_credentials` (validate + hash password, update admin record) or, if that flow isn't implemented yet, have the frontend disable/hide that form until it is — returning a fake "success" is the worse of the two options.

### H3. Duplicate, contradictory Settings pages
**Files:** `frontend/src/app/settings/page.tsx` (223 lines) vs `frontend/src/app/dashboard/settings/page.tsx` (322 lines)
- `/settings` — fully static UI (local `useState` only), **zero API calls**, changes vanish on refresh. Looks like an early UI mockup that was never wired up.
- `/dashboard/settings` — the "real" wired page (currently broken per C1/C5).

Both routes are live in the app simultaneously. A user/admin navigating to `/settings` will believe they saved changes that were never persisted anywhere.
**Fix:** Delete `app/settings/page.tsx` (or redirect it to `/dashboard/settings`) to avoid a phantom settings screen.

### H4. `WhatsApp_Business_Account_ID` field missing from the UI entirely
Per the original spec (`prompt.txt`, item 1) four Meta fields were required: `WhatsApp_Business_Account_ID`, `Phone_Number_ID`, `Permanent_Access_Token`, `App_Secret`. The DB model (`SystemSettings.whatsapp_business_account_id`) and the settings-read API both support it — **but the active settings form only has 3 inputs** (`appId` [mapped to phone_number_id], `appSecret`, `accessToken`). There is no input for the Business Account ID anywhere in the UI.
**Fix:** Add the missing field to the "API Configuration" tab and wire it into `apiConfig` state + the `api_config` payload (map to a distinct key, not reused as `appId`).

### H5. Secrets stored in Redis without the app-level encryption used elsewhere
**File:** `backend/app/api/settings.py`, `store_meta_credentials` (line ~191) does correctly call `encrypt_redis_secret`. But `update_system_settings` (`/settings/system`, POST, line 166) writes the **entire raw Pydantic model to Redis as plain JSON** — including whatever secret-like fields exist on `SystemSettings` — with no encryption at all. This is inconsistent with the encryption discipline used for `meta-credentials` and the DB's `EncryptedText` columns.
**Fix:** Either remove this endpoint (it's redundant with the DB-backed `/settings/` + `SettingsService` flow — see H1 duplication) or encrypt secret fields before the `redis_client.set` call.

---

## 🟡 MEDIUM

### M1. Redundant/parallel settings storage systems
There are effectively **two separate settings systems** living in the same file:
1. DB-backed: `SystemSettings` table + `SettingsService` + `GET/POST /settings/`, `/settings/update` (broadcasts via Redis pub/sub — correctly wired for the C2/C3 fix once applied)
2. Redis-only: `GET/POST /settings/system` (no DB persistence, no pub/sub broadcast, separate schema)
Only #1 is used by the live frontend, but #2 still exists, is reachable, and will silently overwrite/read stale data if anyone (including the dead `useSettings.ts` hook, C4) calls it. This duplication is exactly the kind of thing that causes "it worked yesterday, why is it different today" bugs.
**Fix:** Delete the `/settings/system` GET/POST pair, or clearly document it as deprecated/internal-only.

### M2. Frontend app is far from feature-complete relative to backend
`frontend/src` contains only 8 files total — `dashboard/page.tsx`, `dashboard/settings/page.tsx`, `layout.tsx`, `page.tsx`, `settings/page.tsx`, and 3 hooks. There is no chats/inbox UI, no contacts UI, no phone-number-config management UI — despite the backend having full APIs for `chats.py`, `dashboard.py`, and phone-number CRUD. The much more complete-looking `static-preview/*.html` files (76K, fully designed dashboard/index mockups) appear to be the **design reference that was never actually converted into the real Next.js app**.
**Fix:** Treat `static-preview/` as a design source only; prioritize building out `chats`, `contacts`, and `phone-numbers` pages in the real Next.js app — currently a user has a settings page (partially broken) and nothing else.

### M3. `Encryption_Key_Rotation` and `Language_Selection` / `Theme_Mode` from spec are entirely unimplemented
Spec item 3 ("Encryption Key Rotation" button) and item 4 (Appearance/UI Preferences: theme, notification sound, language) have **no backend fields, no API, no UI** anywhere in the repo. Not a bug, but worth flagging so your dev doesn't assume these exist — they were speced but never started.

### M4. `data_retention_days` change doesn't trigger cleanup
Spec logic: *"If Data_Retention_Days is changed, trigger a background task to clean up old logs/messages."* The field is stored and editable, but no code anywhere (worker, scheduled job, or the update endpoint) enqueues a cleanup task when it changes.
**Fix:** In `update_settings_dashboard`, when `data_retention_days` is in `updates`, enqueue an ARQ job to purge messages older than N days.

---

## Priority Order for Your Dev

1. **C1** — create missing `lib/api-client.ts` (nothing works until this exists)
2. **C4** — delete dead `useSettings.ts`, keep one hook
3. **H3** — delete/redirect the dead static `/settings` page
4. **C2 + C3** — wire worker to actually read `n8n_webhook_url` and `auto_reply_enabled` dynamically (this is the "settings not syncing to backend" issue you specifically flagged)
5. **C5 + H1** — fix auth so SSE live-sync and all settings endpoints actually authenticate correctly
6. **H2, H4** — fix silent `admin_credentials` drop, add missing Business Account ID field
7. **H5, M1** — clean up the redundant Redis-only settings system and its unencrypted secret storage
8. **M2, M3, M4** — roadmap items (features speced but not built)

---

## What Works Well (worth noting, not just criticism)
- `backend/app/api/webhooks.py`: signature verification, idempotency via Redis `SETNX`, ARQ enqueueing with DLQ fallback — production-grade.
- `backend/worker.py`: atomic `UPSERT` for contacts avoiding race conditions, encrypted message storage at rest, real-time pub/sub to frontend.
- `backend/app/workers/outbound.py`: sliding-window rate limiting + global pause on 429 — well thought out for WhatsApp API rate limits.
- DB-level `EncryptedText` column type (AES-256-GCM) for sensitive fields is a solid pattern, just needs to be applied consistently (see H5).
