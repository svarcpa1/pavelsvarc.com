-- Migration 011: Set Bench press machine to Barbell
--
-- One Bench press row was logged with no machine; the other as Barbell.
-- Both are barbell bench presses, so normalize the NULL one to 'Barbell'
-- (Sit-ups left as-is per decision).
--
-- Wrapped in a transaction. To dry-run, change COMMIT to ROLLBACK.

BEGIN;

UPDATE ll_exercises SET machine = 'Barbell'
WHERE name = 'Bench press' AND machine IS NULL;  -- expect 1

-- ---- Verification: Bench press should now have a single machine 'Barbell' ----
SELECT machine, COUNT(*) AS records
FROM ll_exercises
WHERE name = 'Bench press'
GROUP BY machine;

COMMIT;
