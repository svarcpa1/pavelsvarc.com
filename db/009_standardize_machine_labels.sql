-- Migration 009: Standardize LiftLog machine labels to English
--
-- Normalizes the free-text machine field to a consistent English vocabulary,
-- merging synonyms and translating Czech terms. Cable attachments are kept as
-- distinct variants (rope vs straight bar) since they change the movement.
-- The 11 rows with no machine (NULL) are left untouched.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

-- ---- Free weights ----
UPDATE ll_exercises SET machine = 'Barbell'   WHERE machine IN ('Osa', 'Bench press');   -- expect 3
UPDATE ll_exercises SET machine = 'Dumbbells' WHERE machine = 'Jednoručky';               -- expect 5
UPDATE ll_exercises SET machine = 'EZ bar'    WHERE machine IN ('Ez', 'Ez + lavice');     -- expect 5

-- ---- Benches ----
UPDATE ll_exercises SET machine = 'Bench'          WHERE machine IN ('Lavice', 'Lavička');                       -- expect 2
UPDATE ll_exercises SET machine = 'Preacher bench' WHERE machine IN ('Skotova lavice', 'Skotovka', 'Skotovka + EZ'); -- expect 3

-- ---- Machines ----
UPDATE ll_exercises SET machine = 'Stack machine'        WHERE machine = 'Cihličkový stroj';                  -- expect 2
UPDATE ll_exercises SET machine = 'Plate-loaded machine' WHERE machine IN ('Kotoučový stroj', 'Kotouče');     -- expect 3
UPDATE ll_exercises SET machine = 'Smith machine'        WHERE machine = 'Multipress';                        -- expect 5
UPDATE ll_exercises SET machine = 'Leg press machine'    WHERE machine IN ('Leg press', 'Leg press - kotouče'); -- expect 3
UPDATE ll_exercises SET machine = 'Shoulder press machine' WHERE machine = 'Shoulder press';                  -- expect 4

-- ---- Cable + attachments (variants preserved) ----
UPDATE ll_exercises SET machine = 'Cable'              WHERE machine = 'Kladka';                    -- expect 4
UPDATE ll_exercises SET machine = 'Cable - rope'       WHERE machine IN ('Lana', 'Kladka (lana)');  -- expect 3
UPDATE ll_exercises SET machine = 'Cable - straight bar' WHERE machine IN ('Tyč', 'Rovná tyč');     -- expect 2

-- ---- Verification: all old labels should be gone (should return 0 rows) ----
SELECT DISTINCT machine AS leftover_old_machine
FROM ll_exercises
WHERE machine IN (
    'Osa', 'Bench press', 'Jednoručky', 'Ez', 'Ez + lavice',
    'Lavice', 'Lavička', 'Skotova lavice', 'Skotovka', 'Skotovka + EZ',
    'Cihličkový stroj', 'Kotoučový stroj', 'Kotouče', 'Multipress',
    'Leg press', 'Leg press - kotouče', 'Shoulder press',
    'Kladka', 'Lana', 'Kladka (lana)', 'Tyč', 'Rovná tyč'
);

COMMIT;
