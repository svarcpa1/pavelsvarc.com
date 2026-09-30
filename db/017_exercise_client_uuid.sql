-- Migration 017: Client-generated ID on exercises (offline save, no duplicates)
--
-- When the connection is poor, the app saves a new exercise on the phone and
-- sends it to the server later. Each entry carries a unique ID generated on
-- the phone; the server stores it here and ignores repeats, so a retry after
-- a lost reply can't create a duplicate. Existing rows stay NULL (a unique
-- index allows any number of NULLs).
--
-- MUST be applied before the app code that sends client_uuid is deployed.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

ALTER TABLE ll_exercises ADD COLUMN IF NOT EXISTS client_uuid UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_exercises_client_uuid ON ll_exercises(client_uuid);

-- ---- Verification: should return one row (client_uuid, uuid) ----
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'll_exercises' AND column_name = 'client_uuid';

-- ---- Verification: should return the unique index ----
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'll_exercises' AND indexname = 'idx_ll_exercises_client_uuid';

COMMIT;
