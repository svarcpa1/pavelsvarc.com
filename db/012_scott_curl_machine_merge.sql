-- Migration 012: Merge duplicate machine labels for "Scott curl"
--
-- The Scott (preacher) curl was logged under two different machine labels —
-- 'EZ bar' and 'Preacher bench' — even though they describe the same setup
-- (a preacher/Scott bench with an EZ bar). This split the machine-suggestion
-- dropdown and the last-weight history across two entries. Collapse both into
-- a single combined label so the history lines up again.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

UPDATE ll_exercises
SET machine = 'Preacher bench + EZ bar'
WHERE name = 'Scott curl'
  AND machine IN ('EZ bar', 'Preacher bench');   -- merge both into one label

-- ---- Verification: Scott curl should now show one machine label (should
--      return a single 'Preacher bench + EZ bar' row, plus NULL if any) ----
SELECT machine AS scott_curl_machine, COUNT(*) AS rows
FROM ll_exercises
WHERE name = 'Scott curl'
GROUP BY machine
ORDER BY machine;

COMMIT;
