-- Junction table for many-to-many exercise <-> body parts
CREATE TABLE ll_exercise_body_parts (
    exercise_id INT NOT NULL REFERENCES ll_exercises(id) ON DELETE CASCADE,
    body_part_id INT NOT NULL REFERENCES ll_body_parts(id),
    PRIMARY KEY (exercise_id, body_part_id)
);

CREATE INDEX idx_ll_ebp_exercise_id ON ll_exercise_body_parts(exercise_id);
CREATE INDEX idx_ll_ebp_body_part_id ON ll_exercise_body_parts(body_part_id);

-- Migrate existing data from single FK column to junction table
INSERT INTO ll_exercise_body_parts (exercise_id, body_part_id)
SELECT id, body_part_id FROM ll_exercises WHERE body_part_id IS NOT NULL;

-- Drop the old column and its index
DROP INDEX IF EXISTS idx_ll_exercises_body_part_id;
ALTER TABLE ll_exercises DROP COLUMN body_part_id;
