-- Migration 015: Fill in missing machines
--
-- A few exercises were logged without a machine. Label them so every
-- equipment-based exercise has one: the 2026-04-08 Leg extension was on the
-- plate-loaded machine, Dips and Pull-ups are done on the pull-up bar, and
-- Hack squat is on the hack squat machine. Plank and Wheel stay without one.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

UPDATE ll_exercises SET machine = 'Plate-loaded machine'
WHERE name = 'Leg extension' AND (machine IS NULL OR TRIM(machine) = ''); -- expect 1
UPDATE ll_exercises SET machine = 'Pull-up bar'
WHERE name IN ('Dips', 'Pull-ups')
  AND (machine IS NULL OR TRIM(machine) = '');                            -- expect 6
UPDATE ll_exercises SET machine = 'Hack squat machine'
WHERE name = 'Hack squat' AND (machine IS NULL OR TRIM(machine) = '');    -- expect 1

-- ---- Verification 1: only Plank and Wheel should still lack a machine ----
SELECT name, COUNT(*) AS times
FROM ll_exercises
WHERE machine IS NULL OR TRIM(machine) = ''
GROUP BY name
ORDER BY name;

-- ---- Verification 2: touched exercises ----
SELECT name, machine, COUNT(*) AS times
FROM ll_exercises
WHERE name IN ('Leg extension', 'Dips', 'Pull-ups', 'Hack squat')
GROUP BY name, machine
ORDER BY name, machine;

COMMIT;
