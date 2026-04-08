-- Add chest body part (sort between shoulders and core)
INSERT INTO ll_body_parts (name, sort_order) VALUES ('chest', 3);
-- Shift existing items down
UPDATE ll_body_parts SET sort_order = 5 WHERE name = 'core';
UPDATE ll_body_parts SET sort_order = 6 WHERE name = 'biceps';
UPDATE ll_body_parts SET sort_order = 7 WHERE name = 'triceps';

-- Add "Other" gym at the end
INSERT INTO ll_gyms (name, sort_order) VALUES ('Other', 99);
