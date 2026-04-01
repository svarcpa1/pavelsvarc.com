<?php

session_set_cookie_params(['lifetime' => 604800, 'path' => '/liftlog/', 'httponly' => true, 'samesite' => 'Strict']);
session_start();

header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['liftlog_authenticated'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

require_once __DIR__ . '/../../api/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDb();

    if ($method === 'GET') {
        // Single workout detail
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];

            $stmt = $db->prepare('
                SELECT w.id, w.started_at, w.finished_at, w.notes, g.name AS gym_name
                FROM ll_workouts w
                JOIN ll_gyms g ON g.id = w.gym_id
                WHERE w.id = :id
            ');
            $stmt->execute(['id' => $id]);
            $workout = $stmt->fetch();

            if (!$workout) {
                http_response_code(404);
                echo json_encode(['error' => 'Workout not found']);
                exit;
            }

            $stmt = $db->prepare('
                SELECT e.id, e.name, e.machine, e.max_weight, bp.name AS body_part
                FROM ll_exercises e
                JOIN ll_body_parts bp ON bp.id = e.body_part_id
                WHERE e.workout_id = :workout_id
                ORDER BY e.sort_order ASC, e.id ASC
            ');
            $stmt->execute(['workout_id' => $id]);
            $workout['exercises'] = $stmt->fetchAll();

            echo json_encode($workout);
            exit;
        }

        // List workouts
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $stmt = $db->prepare('
            SELECT w.id, w.started_at, w.finished_at, g.name AS gym_name,
                   (SELECT COUNT(*) FROM ll_exercises e WHERE e.workout_id = w.id) AS exercise_count
            FROM ll_workouts w
            JOIN ll_gyms g ON g.id = w.gym_id
            ORDER BY w.started_at DESC
            LIMIT :limit OFFSET :offset
        ');
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode($stmt->fetchAll());
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $gymId = (int)($input['gym_id'] ?? 0);

        if (!$gymId) {
            http_response_code(400);
            echo json_encode(['error' => 'gym_id is required']);
            exit;
        }

        $stmt = $db->prepare('INSERT INTO ll_workouts (gym_id) VALUES (:gym_id) RETURNING id, gym_id, started_at');
        $stmt->execute(['gym_id' => $gymId]);

        echo json_encode($stmt->fetch());
        exit;
    }

    if ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = (int)($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            exit;
        }

        $stmt = $db->prepare('UPDATE ll_workouts SET finished_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->execute(['id' => $id]);

        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
