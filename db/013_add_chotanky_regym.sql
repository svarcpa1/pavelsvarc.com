-- Migration 013: Add "Choťánky - RE-GYM" gym and reassign recent "Other" workouts
--
-- The last three workouts logged under the catch-all "Other" gym were actually
-- done at Choťánky - RE-GYM. Add the gym (sorted after the existing named gyms,
-- before "Other") and move those three workouts over to it.
--
-- Wrapped in a transaction. To dry-run, change the final COMMIT to ROLLBACK
-- and inspect the preview/verification query output first.

BEGIN;

-- ---- Preview: the three workouts that will be moved ----
SELECT w.id, w.started_at, g.name AS gym
FROM ll_workouts w
JOIN ll_gyms g ON g.id = w.gym_id
WHERE g.name = 'Other'
ORDER BY w.started_at DESC
LIMIT 3;

INSERT INTO ll_gyms (name, sort_order) VALUES ('Choťánky - RE-GYM', 5);

UPDATE ll_workouts
SET gym_id = (SELECT id FROM ll_gyms WHERE name = 'Choťánky - RE-GYM')
WHERE id IN (
    SELECT w.id
    FROM ll_workouts w
    JOIN ll_gyms g ON g.id = w.gym_id
    WHERE g.name = 'Other'
    ORDER BY w.started_at DESC
    LIMIT 3
);

-- ---- Verification: should return the same three workout ids, now at RE-GYM ----
SELECT w.id, w.started_at, g.name AS gym
FROM ll_workouts w
JOIN ll_gyms g ON g.id = w.gym_id
WHERE g.name = 'Choťánky - RE-GYM'
ORDER BY w.started_at DESC;

-- ---- Verification: gym list order ----
SELECT id, name, sort_order FROM ll_gyms ORDER BY sort_order;

COMMIT;
