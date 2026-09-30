-- Migration 016: Fix workouts that were left running (forgot to finish)
--
-- Workouts 72 (31 h), 73 (5.5 days) and 55 (3 h 14 min) were not finished on
-- time, so the timer kept running and inflated the dashboard's average
-- duration (~377 min). Reset them to the average of the normal workouts
-- (61 min, computed over all finished workouts excluding these three).
--
-- The duration guard (> 180 min) makes a second run a no-op.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

UPDATE ll_workouts
SET finished_at = started_at + INTERVAL '61 minutes'
WHERE id IN (55, 72, 73)
  AND finished_at - started_at > INTERVAL '180 minutes';   -- expect 3

-- ---- Verification 1: the three workouts should now show 61 min ----
SELECT id, started_at, finished_at,
       ROUND(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60) AS minutes
FROM ll_workouts
WHERE id IN (55, 72, 73)
ORDER BY id;

-- ---- Verification 2: longest remaining workout should be ~127 min, and
--      the dashboard average ~62 min ----
SELECT MAX(ROUND(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60)) AS max_minutes,
       ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60)) AS avg_minutes
FROM ll_workouts
WHERE finished_at IS NOT NULL;

COMMIT;
