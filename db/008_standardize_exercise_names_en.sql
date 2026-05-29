-- Migration 008: Standardize LiftLog exercise names to English
--
-- Renames colloquial / slang / typo exercise names to clean English terms.
-- The "Stahování kladky" entry is split into two distinct exercises based on
-- the linked body part (back = lat pulldown, triceps = triceps pushdown),
-- since one name was covering two different movements.
--
-- Body parts are left unchanged (Arnold 21s stays biceps, per confirmation).
-- Machine labels are NOT touched here -- that's a separate standardization pass.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the verification query output first.

BEGIN;

-- ---- Simple 1:1 renames ----
UPDATE ll_exercises SET name = 'Rowing'                    WHERE name = 'Veslovalní';        -- expect 1
UPDATE ll_exercises SET name = 'Arnold 21s'               WHERE name = 'Arnoldovka';        -- expect 2
UPDATE ll_exercises SET name = 'Scott curl'               WHERE name = 'Skotovka';          -- expect 4
UPDATE ll_exercises SET name = 'Pec deck fly'             WHERE name = 'K sobě stroj';      -- expect 1
UPDATE ll_exercises SET name = 'Rotation curl'            WHERE name = 'Vytáčení';          -- expect 1
UPDATE ll_exercises SET name = 'Face pull'                WHERE name = 'Přítahy na držku';  -- expect 1

-- ---- Merge two names into the same lying EZ-bar French press ----
UPDATE ll_exercises SET name = 'Lying EZ-bar French press' WHERE name = 'Zvedání od držky'; -- expect 1
UPDATE ll_exercises SET name = 'Lying EZ-bar French press' WHERE name = 'Press';            -- expect 1

-- ---- Split "Stahování kladky" by body part ----
-- Back-tagged rows = lat pulldown
UPDATE ll_exercises e
SET name = 'Lat pulldown'
WHERE e.name = 'Stahování kladky'
  AND EXISTS (
      SELECT 1 FROM ll_exercise_body_parts ebp
      JOIN ll_body_parts bp ON bp.id = ebp.body_part_id
      WHERE ebp.exercise_id = e.id AND bp.name = 'back'
  );                                                                                          -- expect 5

-- Triceps-tagged rows = triceps pushdown
UPDATE ll_exercises e
SET name = 'Triceps pushdown'
WHERE e.name = 'Stahování kladky'
  AND EXISTS (
      SELECT 1 FROM ll_exercise_body_parts ebp
      JOIN ll_body_parts bp ON bp.id = ebp.body_part_id
      WHERE ebp.exercise_id = e.id AND bp.name = 'triceps'
  );                                                                                          -- expect 5

-- ---- Verification: all old names should be gone (should return 0 rows) ----
SELECT DISTINCT name AS leftover_old_name
FROM ll_exercises
WHERE name IN (
    'Veslovalní', 'Arnoldovka', 'Skotovka', 'K sobě stroj', 'Vytáčení',
    'Přítahy na držku', 'Zvedání od držky', 'Press', 'Stahování kladky'
);

COMMIT;
