-- Update Fitness Tracker tile to reflect LiftLog
UPDATE projects
SET title = 'LiftLog',
    description = 'Mobile-first fitness tracker for logging workouts, exercises, and progress.',
    tags = ARRAY['HTML', 'CSS', 'JavaScript', 'PHP', 'PostgreSQL']
WHERE title = 'Fitness Tracker';
