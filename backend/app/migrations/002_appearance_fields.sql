-- /backend/app/migrations/002_appearance_fields.sql
-- Adds Appearance / UI preference columns to the system_settings table.
--
-- WHEN TO RUN:
--   Apply this migration on any existing deployment that was running before
--   this commit. Fresh installs using `docker compose up --build` do NOT need
--   to run this manually — Base.metadata.create_all() handles new columns on
--   fresh databases.
--
-- HOW TO RUN (inside the running Postgres container):
--   docker exec -it anfa-postgres-db psql -U anfa_admin_user -d anfa_whatsapp_crm_db -f /migration.sql
-- OR via psql from host:
--   psql "postgresql://anfa_admin_user:<password>@localhost:5432/anfa_whatsapp_crm_db" -f 002_appearance_fields.sql

BEGIN;

-- Add theme_mode column (enum-like: 'light' | 'dark' | 'system')
ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10) NOT NULL DEFAULT 'dark';

-- Add language column (BCP-47 language code, e.g. 'en', 'ur', 'ar')
ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS language VARCHAR(10) NOT NULL DEFAULT 'en';

-- Add notification_sound_enabled column
ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Verify the columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'system_settings'
  AND column_name IN ('theme_mode', 'language', 'notification_sound_enabled');

COMMIT;
