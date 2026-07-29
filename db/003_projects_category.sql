-- Add Public/Private grouping to landing-page projects.
-- Run once against the production DB (psql on webglobe.cz).

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'public';

-- Existing projects are personal work -> Private.
-- LiftLog now links to its sub-app.
UPDATE projects
    SET category = 'private', url = '/liftlog/'
    WHERE title ILIKE '%liftlog%' OR title ILIKE '%fitness%';

UPDATE projects
    SET category = 'private'
    WHERE title ILIKE '%wedding%';

-- New public (client) project. Reference only.
INSERT INTO projects (title, description, url, tags, category, sort_order)
SELECT 'Autosklo Partner',
       'Website I designed and built for an auto-glass service.',
       'https://autosklopartner.eu',
       ARRAY['HTML', 'CSS', 'JavaScript'],
       'public',
       1
WHERE NOT EXISTS (
    SELECT 1 FROM projects WHERE url = 'https://autosklopartner.eu'
);
