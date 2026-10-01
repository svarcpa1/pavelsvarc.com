<?php

session_set_cookie_params(['lifetime' => 604800, 'path' => '/liftlog/', 'httponly' => true, 'secure' => true, 'samesite' => 'Strict']);
session_start();

header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['liftlog_authenticated'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../../api/db.php';
require_once __DIR__ . '/_records.php';

try {
    $db = getDb();

    // ---- Single exercise progress: ?exercise=Name ----
    // Every session of that exercise (all machines, all gyms), oldest first.
    // The client filters by gym — machines aren't comparable across gyms.
    if (isset($_GET['exercise'])) {
        $name = trim($_GET['exercise']);

        $stmt = $db->prepare('
            WITH ' . LL_RECORDS_CTE . '
            SELECT w.started_at, w.gym_id, g.name AS gym, e.machine, e.max_weight, r.is_record
            FROM ll_exercises e
            JOIN ll_workouts w ON w.id = e.workout_id
            JOIN ll_gyms g ON g.id = w.gym_id
            JOIN ll_records r ON r.id = e.id
            WHERE LOWER(e.name) = LOWER(:name)
            ORDER BY w.started_at, e.id
        ');
        $stmt->execute(['name' => $name]);
        $sessions = $stmt->fetchAll();

        $stmt = $db->prepare('
            SELECT DISTINCT bp.name, bp.sort_order
            FROM ll_exercises e
            JOIN ll_exercise_body_parts ebp ON ebp.exercise_id = e.id
            JOIN ll_body_parts bp ON bp.id = ebp.body_part_id
            WHERE LOWER(e.name) = LOWER(:name)
            ORDER BY bp.sort_order
        ');
        $stmt->execute(['name' => $name]);

        echo json_encode([
            'name'       => $name,
            'body_parts' => array_column($stmt->fetchAll(), 'name'),
            'sessions'   => $sessions,
        ]);
        exit;
    }

    // ---- Summary tiles ----
    $summary = $db->query("
        SELECT
            (SELECT COUNT(*) FROM ll_workouts) AS total_workouts,
            (SELECT COUNT(*) FROM ll_workouts
             WHERE started_at >= CURRENT_DATE - INTERVAL '30 days') AS workouts_30d,
            (SELECT COUNT(*) FROM ll_exercises) AS total_exercises,
            (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60))
             FROM ll_workouts WHERE finished_at IS NOT NULL) AS avg_duration_min
    ")->fetch();

    // ---- Workouts per month (last 6 months, zero-filled) ----
    $frequency = $db->query("
        SELECT to_char(m, 'YYYY-MM') AS month, COALESCE(c.cnt, 0) AS count
        FROM generate_series(
            date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) m
        LEFT JOIN (
            SELECT date_trunc('month', started_at) AS mon, COUNT(*) AS cnt
            FROM ll_workouts
            GROUP BY 1
        ) c ON c.mon = m
        ORDER BY m
    ")->fetchAll();

    // ---- Personal records: heaviest weight per exercise + gym (top 10) ----
    $records = $db->query("
        SELECT MIN(e.name) AS name, w.gym_id, g.name AS gym, MAX(e.max_weight) AS max_weight
        FROM ll_exercises e
        JOIN ll_workouts w ON w.id = e.workout_id
        JOIN ll_gyms g ON g.id = w.gym_id
        WHERE e.max_weight IS NOT NULL
        GROUP BY LOWER(e.name), w.gym_id, g.name
        ORDER BY MAX(e.max_weight) DESC, MIN(e.name)
        LIMIT 10
    ")->fetchAll();

    // ---- Days since each body part was last trained (NULL = never) ----
    $daysSince = $db->query("
        SELECT bp.name, CURRENT_DATE - MAX(w.started_at)::date AS days
        FROM ll_body_parts bp
        LEFT JOIN ll_exercise_body_parts ebp ON ebp.body_part_id = bp.id
        LEFT JOIN ll_exercises e ON e.id = ebp.exercise_id
        LEFT JOIN ll_workouts w ON w.id = e.workout_id
        GROUP BY bp.id, bp.name, bp.sort_order
        ORDER BY bp.sort_order
    ")->fetchAll();

    // ---- Exercises per body part per week (last 12 weeks, zero-filled) ----
    // An exercise tagged with several body parts counts for each of them.
    $weekly = $db->query("
        SELECT to_char(g.wk, 'YYYY-MM-DD') AS week, bp.name, COUNT(x.exercise_id) AS count
        FROM generate_series(
            date_trunc('week', CURRENT_DATE::timestamp) - INTERVAL '11 weeks',
            date_trunc('week', CURRENT_DATE::timestamp),
            INTERVAL '1 week'
        ) AS g(wk)
        CROSS JOIN ll_body_parts bp
        LEFT JOIN (
            SELECT date_trunc('week', w.started_at) AS wk, ebp.body_part_id, ebp.exercise_id
            FROM ll_workouts w
            JOIN ll_exercises e ON e.workout_id = w.id
            JOIN ll_exercise_body_parts ebp ON ebp.exercise_id = e.id
        ) x ON x.wk = g.wk AND x.body_part_id = bp.id
        GROUP BY g.wk, bp.id, bp.name, bp.sort_order
        ORDER BY g.wk, bp.sort_order
    ")->fetchAll();

    // ---- Exercise list: best, last and trend per exercise name ----
    // Trend compares the last session with the previous one on the same gym + machine.
    $rows = $db->query("
        SELECT e.name, e.machine, e.max_weight, w.started_at, w.gym_id
        FROM ll_exercises e
        JOIN ll_workouts w ON w.id = e.workout_id
        ORDER BY w.started_at DESC, e.id DESC
    ")->fetchAll();

    $byName = [];
    foreach ($rows as $row) {
        $key = strtolower($row['name']);
        if (!isset($byName[$key])) {
            $byName[$key] = [
                'name'         => $row['name'],
                'times'        => 0,
                'best_weight'  => null,
                'last_date'    => $row['started_at'],
                'last_weight'  => $row['max_weight'],
                'last_machine' => $row['machine'],
                'last_gym_id'  => $row['gym_id'],
                'trend'        => null,
            ];
        }
        $ex = &$byName[$key];
        $ex['times']++;
        if ($row['max_weight'] !== null
            && ($ex['best_weight'] === null || (float)$row['max_weight'] > (float)$ex['best_weight'])) {
            $ex['best_weight'] = $row['max_weight'];
        }
        // First earlier row on the same gym + machine decides the trend
        if ($ex['times'] > 1 && $ex['trend'] === null
            && $ex['last_weight'] !== null && $row['max_weight'] !== null
            && $row['gym_id'] === $ex['last_gym_id']
            && strtolower($row['machine'] ?? '') === strtolower($ex['last_machine'] ?? '')) {
            $diff = (float)$ex['last_weight'] - (float)$row['max_weight'];
            $ex['trend'] = $diff > 0 ? 'up' : ($diff < 0 ? 'down' : 'flat');
        }
        unset($ex);
    }
    $exerciseList = array_values($byName);
    usort($exerciseList, fn($a, $b) => [$b['times'], $a['name']] <=> [$a['times'], $b['name']]);

    echo json_encode([
        'summary'           => $summary,
        'frequency'         => $frequency,
        'personal_records'  => $records,
        'days_since'        => $daysSince,
        'weekly_body_parts' => $weekly,
        'exercises'         => $exerciseList,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load stats']);
}
