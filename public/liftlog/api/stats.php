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

try {
    $db = getDb();

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

    // ---- Personal records: heaviest weight per exercise (top 10) ----
    $records = $db->query("
        SELECT name, MAX(max_weight) AS max_weight
        FROM ll_exercises
        WHERE max_weight IS NOT NULL
        GROUP BY name
        ORDER BY MAX(max_weight) DESC, name
        LIMIT 10
    ")->fetchAll();

    // ---- Muscle group balance: exercises logged per body part ----
    $balance = $db->query("
        SELECT bp.name, COUNT(ebp.exercise_id) AS count
        FROM ll_body_parts bp
        LEFT JOIN ll_exercise_body_parts ebp ON ebp.body_part_id = bp.id
        GROUP BY bp.id, bp.name, bp.sort_order
        ORDER BY bp.sort_order
    ")->fetchAll();

    echo json_encode([
        'summary'          => $summary,
        'frequency'        => $frequency,
        'personal_records' => $records,
        'body_part_balance' => $balance,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load stats']);
}
