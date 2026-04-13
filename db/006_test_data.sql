-- ==========================================================
-- Test data for LiftLog
-- 5 finished workouts across different gyms, dates, exercises
-- Tests: autocomplete, last weight indicator, trained parts
-- ==========================================================

DO $$
DECLARE
    w_id INT;
    e_id INT;
    bp_legs INT;
    bp_back INT;
    bp_shoulders INT;
    bp_chest INT;
    bp_core INT;
    bp_biceps INT;
    bp_triceps INT;
BEGIN
    -- Resolve body part IDs
    SELECT id INTO bp_legs FROM ll_body_parts WHERE name = 'legs';
    SELECT id INTO bp_back FROM ll_body_parts WHERE name = 'back';
    SELECT id INTO bp_shoulders FROM ll_body_parts WHERE name = 'shoulders';
    SELECT id INTO bp_chest FROM ll_body_parts WHERE name = 'chest';
    SELECT id INTO bp_core FROM ll_body_parts WHERE name = 'core';
    SELECT id INTO bp_biceps FROM ll_body_parts WHERE name = 'biceps';
    SELECT id INTO bp_triceps FROM ll_body_parts WHERE name = 'triceps';

    -- ===== WORKOUT 1: 3 weeks ago — Legs + Core at Bonasus =====
    INSERT INTO ll_workouts (gym_id, started_at, finished_at)
    VALUES (1, NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days' + INTERVAL '55 min')
    RETURNING id INTO w_id;

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Squat', 'Smith machine', 80.00, 1) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Leg press', 120.00, 2) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Leg curl', 'Machine', 45.00, 3) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Plank', NULL, 4) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_core);

    -- ===== WORKOUT 2: 2 weeks ago — Chest + Triceps at Poděbrady 24 =====
    INSERT INTO ll_workouts (gym_id, started_at, finished_at)
    VALUES (2, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days' + INTERVAL '50 min')
    RETURNING id INTO w_id;

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Bench press', NULL, 65.00, 1) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_chest);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Incline dumbbell press', NULL, 22.00, 2) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_chest);
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_shoulders);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Tricep pushdown', 'Cable', 30.00, 3) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_triceps);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Dips', NULL, 4) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_triceps);
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_chest);

    -- ===== WORKOUT 3: 10 days ago — Back + Biceps at Praha Čerňák =====
    INSERT INTO ll_workouts (gym_id, started_at, finished_at)
    VALUES (4, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days' + INTERVAL '65 min')
    RETURNING id INTO w_id;

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Pull-ups', NULL, 1) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_back);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Barbell row', NULL, 60.00, 2) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_back);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Lat pulldown', 'Cable', 55.00, 3) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_back);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Bicep curl', 'Dumbbell', 14.00, 4) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_biceps);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Hammer curl', 'Dumbbell', 12.00, 5) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_biceps);

    -- ===== WORKOUT 4: 5 days ago — Shoulders + Legs at Bonasus =====
    INSERT INTO ll_workouts (gym_id, started_at, finished_at)
    VALUES (1, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '60 min')
    RETURNING id INTO w_id;

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Overhead press', 40.00, 1) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_shoulders);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Lateral raise', 'Dumbbell', 10.00, 2) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_shoulders);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Squat', 'Smith machine', 85.00, 3) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Leg press', 130.00, 4) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    -- ===== WORKOUT 5: 2 days ago — Full body at Poděbrady Staďák =====
    INSERT INTO ll_workouts (gym_id, started_at, finished_at)
    VALUES (3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '70 min')
    RETURNING id INTO w_id;

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Bench press', 70.00, 1) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_chest);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Squat', 90.00, 2) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_legs);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Lat pulldown', 'Cable', 60.00, 3) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_back);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Overhead press', 42.00, 4) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_shoulders);

    INSERT INTO ll_exercises (workout_id, name, max_weight, sort_order)
    VALUES (w_id, 'Plank', NULL, 5) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_core);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Bicep curl', 'Dumbbell', 16.00, 6) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_biceps);

    INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
    VALUES (w_id, 'Tricep pushdown', 'Cable', 32.00, 7) RETURNING id INTO e_id;
    INSERT INTO ll_exercise_body_parts VALUES (e_id, bp_triceps);

    RAISE NOTICE 'Test data inserted: 5 workouts, 23 exercises';
END $$;
