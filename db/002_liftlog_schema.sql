-- LiftLog schema
-- All tables prefixed ll_ to namespace within shared database

-- Gyms reference table
CREATE TABLE ll_gyms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ll_gyms (name, sort_order) VALUES
('Chlumec - Bonasus', 1),
('Poděbrady - 24', 2),
('Poděbrady - Staďák', 3),
('Praha - Čerňák', 4);

-- Body parts reference table
CREATE TABLE ll_body_parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    sort_order INT DEFAULT 0
);

INSERT INTO ll_body_parts (name, sort_order) VALUES
('legs', 1),
('back', 2),
('shoulders', 3),
('core', 4),
('biceps', 5),
('triceps', 6);

-- Workouts (one row per gym session)
CREATE TABLE ll_workouts (
    id SERIAL PRIMARY KEY,
    gym_id INT NOT NULL REFERENCES ll_gyms(id),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ll_workouts_started_at ON ll_workouts(started_at DESC);
CREATE INDEX idx_ll_workouts_gym_id ON ll_workouts(gym_id);

-- Exercises within a workout
CREATE TABLE ll_exercises (
    id SERIAL PRIMARY KEY,
    workout_id INT NOT NULL REFERENCES ll_workouts(id) ON DELETE CASCADE,
    body_part_id INT NOT NULL REFERENCES ll_body_parts(id),
    name VARCHAR(200) NOT NULL,
    machine VARCHAR(200),
    max_weight NUMERIC(6,2),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ll_exercises_workout_id ON ll_exercises(workout_id);
CREATE INDEX idx_ll_exercises_body_part_id ON ll_exercises(body_part_id);
CREATE INDEX idx_ll_exercises_name ON ll_exercises(name);
