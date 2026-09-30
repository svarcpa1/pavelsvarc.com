-- Migration 014: Merge near-duplicate exercise names and machine labels
--
-- A full review of exercise/machine combinations turned up typos, casing
-- differences, missing machines and the same exercise logged under two names.
-- All of these split the reporting (dashboard, last-weight hints, suggestions)
-- across several entries. Collapse them into one canonical name/label each.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

-- ---- A: typos, casing, missing machines ----
UPDATE ll_exercises SET machine = 'EZ bar'
WHERE name = 'Biceps curl' AND machine = 'Ez bar';                       -- expect 2
UPDATE ll_exercises SET machine = 'Smith machine'
WHERE machine = 'Smith Machine';                                         -- expect 3
UPDATE ll_exercises SET machine = 'Plate-loaded machine'
WHERE machine = 'Plate loaded machine';                                  -- expect 1
UPDATE ll_exercises SET name = 'Bent-over row'
WHERE name = 'Bend-over row';                                            -- expect 2
UPDATE ll_exercises SET name = 'Ab crunch', machine = 'Ab crunch machine'
WHERE name = 'Complete abdomim';                                         -- expect 1
UPDATE ll_exercises SET machine = 'Stairs machine'
WHERE name = 'Stairs' AND (machine IS NULL OR TRIM(machine) = '');       -- expect 2
UPDATE ll_exercises SET machine = 'Deck fly machine'
WHERE name = 'Pec deck fly' AND (machine IS NULL OR TRIM(machine) = ''); -- expect 1
UPDATE ll_exercises SET machine = 'Cable'
WHERE name = 'Lat pulldown' AND (machine IS NULL OR TRIM(machine) = ''); -- expect 1

-- ---- B: same exercise under two names ----
UPDATE ll_exercises SET name = 'Rear delt fly', machine = 'Rear delt fly machine'
WHERE name IN ('Back shoulder extensions', 'Bend shoulders extension');  -- expect 2
UPDATE ll_exercises SET name = 'Back extensions', machine = 'Hyperextension bench'
WHERE name IN ('Lower back raises', 'Back extensions');                  -- expect 6
UPDATE ll_exercises SET name = 'Lying French press'
WHERE name = 'Lying EZ-bar French press';                                -- expect 6
UPDATE ll_exercises SET name = 'Seated French press'
WHERE name = 'French press';                                             -- expect 4
UPDATE ll_exercises SET machine = 'Cable'
WHERE name = 'Face pull' AND (machine IS NULL OR TRIM(machine) = '');    -- expect 1

-- Face pull should always count as back + shoulders
INSERT INTO ll_exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, (SELECT id FROM ll_body_parts WHERE name = 'back')
FROM ll_exercises e
WHERE e.name = 'Face pull'
  AND NOT EXISTS (
      SELECT 1 FROM ll_exercise_body_parts ebp
      JOIN ll_body_parts b ON b.id = ebp.body_part_id
      WHERE ebp.exercise_id = e.id AND b.name = 'back'
  );                                                                     -- expect 1

-- ---- C: machine label clean-up ----
UPDATE ll_exercises SET machine = 'Stack machine'
WHERE name = 'Leg extension' AND machine = 'Leg extension machine';      -- expect 1
UPDATE ll_exercises SET machine = 'Incline chest press machine'
WHERE machine = 'Incline chest press plate machine';                     -- expect 2
UPDATE ll_exercises SET machine = 'Pull-up bar'
WHERE name = 'Leg raises' AND machine IS DISTINCT FROM 'Pull-up bar';    -- expect 9
UPDATE ll_exercises SET machine = 'Bench'
WHERE name = 'Sit-ups' AND machine IS DISTINCT FROM 'Bench';             -- expect 1
UPDATE ll_exercises SET machine = 'Straight bar'
WHERE name = 'Arnold 21s' AND machine = 'Barbell';                       -- expect 1

-- ---- Verification 1: old names/labels should be gone (0 rows) ----
SELECT name, machine
FROM ll_exercises
WHERE name IN ('Bend-over row', 'Complete abdomim', 'Back shoulder extensions',
               'Bend shoulders extension', 'Lower back raises',
               'Lying EZ-bar French press', 'French press')
   OR machine IN ('Ez bar', 'Smith Machine', 'Plate loaded machine',
                  'Leg extension machine', 'Incline chest press plate machine',
                  'Back raises Bench');

-- ---- Verification 2: touched exercises, one row per name/body parts/machine ----
SELECT e.name AS exercise,
       COALESCE(bp.parts, '(none)') AS body_parts,
       COALESCE(NULLIF(TRIM(e.machine), ''), '(none)') AS machine,
       COUNT(*) AS times
FROM ll_exercises e
LEFT JOIN (
    SELECT ebp.exercise_id, STRING_AGG(b.name, ', ' ORDER BY b.sort_order) AS parts
    FROM ll_exercise_body_parts ebp
    JOIN ll_body_parts b ON b.id = ebp.body_part_id
    GROUP BY ebp.exercise_id
) bp ON bp.exercise_id = e.id
WHERE e.name IN ('Biceps curl', 'Face pull', 'Front pulldown', 'Bent-over row',
                 'Ab crunch', 'Stairs', 'Pec deck fly', 'Lat pulldown',
                 'Rear delt fly', 'Back extensions', 'Lying French press',
                 'Seated French press',
                 'Leg extension', 'Incline chest press', 'Leg raises',
                 'Sit-ups', 'Arnold 21s')
GROUP BY e.name, bp.parts, e.machine
ORDER BY LOWER(e.name), machine;

COMMIT;
