CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    url VARCHAR(500),
    tags TEXT[],
    sort_order INT DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data (remove after testing)
INSERT INTO projects (title, description, url, tags, sort_order) VALUES
('Fitness Tracker', 'A simple app to track workouts and progress.', NULL, ARRAY['PHP', 'JavaScript'], 1),
('Wedding Guest Page', 'Minimal webpage for wedding guests with RSVP.', NULL, ARRAY['HTML', 'CSS'], 2);
