-- Migration 007: Standardize LiftLog exercise & machine naming
--
-- Normalizes inconsistent exercise names and machine labels found in the
-- existing data. Each statement is an exact-string match so unrelated rows
-- (e.g. "Přítahy na držku", "Stahování kladky") are left untouched.
--
-- Decisions:
--   1. Redundant machine=name cases (Bench/Shoulder/Leg press) -- KEPT as-is
--   2. Accent variant            "Stáhování kladky"  -> "Stahování kladky"
--      Machine singular/plural   "Jednoručka"        -> "Jednoručky"
--   3. Machine spelling          "Multipower"        -> "Multipress"
--   4. Duplicate exercise        "Přitahování nohou" -> "Přítahy nohou"
--   5. Overloaded "Stahování kladky" + cable attachments -- KEPT as-is
--   6. Typos: "Squad" -> "Squat",  "Haken squad" -> "Hack squat"
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output before committing for real.

BEGIN;

-- ---- Exercise name fixes ----
UPDATE ll_exercises SET name = 'Stahování kladky' WHERE name = 'Stáhování kladky';  -- expect 1
UPDATE ll_exercises SET name = 'Přítahy nohou'    WHERE name = 'Přitahování nohou'; -- expect 1
UPDATE ll_exercises SET name = 'Squat'            WHERE name = 'Squad';             -- expect 1
UPDATE ll_exercises SET name = 'Hack squat'       WHERE name = 'Haken squad';       -- expect 1

-- ---- Machine name fixes ----
UPDATE ll_exercises SET machine = 'Multipress' WHERE machine = 'Multipower';        -- expect 2
UPDATE ll_exercises SET machine = 'Jednoručky' WHERE machine = 'Jednoručka';        -- expect 1

-- ---- Verification: confirm the old values are gone (should return 0 rows) ----
SELECT name AS leftover_name FROM ll_exercises
WHERE name IN ('Stáhování kladky', 'Přitahování nohou', 'Squad', 'Haken squad')
UNION ALL
SELECT machine FROM ll_exercises
WHERE machine IN ('Multipower', 'Jednoručka');

COMMIT;
