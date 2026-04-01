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

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $workoutId = (int)($input['workout_id'] ?? 0);
        $bodyPartId = (int)($input['body_part_id'] ?? 0);
        $name = trim($input['name'] ?? '');
        $machine = trim($input['machine'] ?? '') ?: null;
        $maxWeight = isset($input['max_weight']) && $input['max_weight'] !== '' ? (float)$input['max_weight'] : null;

        if (!$workoutId || !$bodyPartId || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'workout_id, body_part_id, and name are required']);
            exit;
        }

        // Get next sort_order for this workout
        $stmt = $db->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ll_exercises WHERE workout_id = :workout_id');
        $stmt->execute(['workout_id' => $workoutId]);
        $sortOrder = (int)$stmt->fetchColumn();

        $stmt = $db->prepare('
            INSERT INTO ll_exercises (workout_id, body_part_id, name, machine, max_weight, sort_order)
            VALUES (:workout_id, :body_part_id, :name, :machine, :max_weight, :sort_order)
            RETURNING id, workout_id, body_part_id, name, machine, max_weight, sort_order
        ');
        $stmt->execute([
            'workout_id' => $workoutId,
            'body_part_id' => $bodyPartId,
            'name' => $name,
            'machine' => $machine,
            'max_weight' => $maxWeight,
            'sort_order' => $sortOrder,
        ]);

        $exercise = $stmt->fetch();

        // Also return body part name
        $bpStmt = $db->prepare('SELECT name FROM ll_body_parts WHERE id = :id');
        $bpStmt->execute(['id' => $bodyPartId]);
        $exercise['body_part'] = $bpStmt->fetchColumn();

        echo json_encode($exercise);
        exit;
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'id is required']);
            exit;
        }

        $stmt = $db->prepare('DELETE FROM ll_exercises WHERE id = :id');
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
