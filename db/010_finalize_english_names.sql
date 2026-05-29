-- Migration 010: Finalize English exercise names + body-part sort fix
--
-- Translates the remaining Czech exercise names to English, merges the core
-- "leg" variants into a single "Leg raises", folds the preacher-bench
-- "Biceps curl" into "Scott curl", and fixes the duplicate body-part
-- sort_order (shoulders and chest were both 3).
--
-- Gyms are intentionally left in Czech (real place names).
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

-- ---- Straight translations ----
UPDATE ll_exercises SET name = 'Leg extension' WHERE name = 'Předkopávání'; -- expect 3
UPDATE ll_exercises SET name = 'Lunges'        WHERE name = 'Výpady';       -- expect 1
UPDATE ll_exercises SET name = 'Leg curl'      WHERE name = 'Zakopávání';   -- expect 2
UPDATE ll_exercises SET name = 'Sit-ups'       WHERE name = 'Sedy lehy';    -- expect 2
UPDATE ll_exercises SET name = 'Pull-ups'      WHERE name = 'Shyby';        -- expect 1

-- ---- Merge core "leg" variants into Leg raises ----
UPDATE ll_exercises SET name = 'Leg raises' WHERE name = 'Zvedání nohou';   -- expect 1
UPDATE ll_exercises SET name = 'Leg raises' WHERE name = 'Přítahy nohou';   -- expect 2

-- ---- Preacher-bench Biceps curl is a Scott curl ----
UPDATE ll_exercises SET name = 'Scott curl' WHERE name = 'Biceps curl';     -- expect 1

-- ---- Body-part sort_order fix (shoulders=3, chest was also 3 -> chest=4) ----
UPDATE ll_body_parts SET sort_order = 4 WHERE name = 'chest';               -- expect 1

-- ---- Verification 1: all old exercise names should be gone (0 rows) ----
SELECT DISTINCT name AS leftover_old_name
FROM ll_exercises
WHERE name IN (
    'Předkopávání', 'Výpady', 'Zakopávání', 'Sedy lehy', 'Shyby',
    'Zvedání nohou', 'Přítahy nohou', 'Biceps curl'
);

-- ---- Verification 2: body-part order should now be 1..7 with no dupes ----
SELECT sort_order, name FROM ll_body_parts ORDER BY sort_order;

COMMIT;
