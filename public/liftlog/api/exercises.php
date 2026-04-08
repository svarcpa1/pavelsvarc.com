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

$method = $_SERVER['REQUEST_METHOD'];

function getExerciseBodyParts(PDO $db, int $exerciseId): array {
    $stmt = $db->prepare('
        SELECT bp.id, bp.name
        FROM ll_exercise_body_parts ebp
        JOIN ll_body_parts bp ON bp.id = ebp.body_part_id
        WHERE ebp.exercise_id = :exercise_id
        ORDER BY bp.sort_order
    ');
    $stmt->execute(['exercise_id' => $exerciseId]);
    return $stmt->fetchAll();
}

function insertBodyParts(PDO $db, int $exerciseId, array $bodyPartIds): void {
    $stmt = $db->prepare('INSERT INTO ll_exercise_body_parts (exercise_id, body_part_id) VALUES (:exercise_id, :body_part_id)');
    foreach ($bodyPartIds as $bpId) {
        $stmt->execute(['exercise_id' => $exerciseId, 'body_part_id' => (int)$bpId]);
    }
}

try {
    $db = getDb();

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        $workoutId = (int)($input['workout_id'] ?? 0);
        $bodyPartIds = $input['body_part_ids'] ?? [];
        $name = trim($input['name'] ?? '');
        $machine = trim($input['machine'] ?? '') ?: null;
        $maxWeight = isset($input['max_weight']) && $input['max_weight'] !== '' ? (float)$input['max_weight'] : null;

        if (!$workoutId || empty($bodyPartIds) || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'workout_id, body_part_ids, and name are required']);
            exit;
        }

        $db->beginTransaction();

        // Get next sort_order for this workout
        $stmt = $db->prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM ll_exercises WHERE workout_id = :workout_id');
        $stmt->execute(['workout_id' => $workoutId]);
        $sortOrder = (int)$stmt->fetchColumn();

        $stmt = $db->prepare('
            INSERT INTO ll_exercises (workout_id, name, machine, max_weight, sort_order)
            VALUES (:workout_id, :name, :machine, :max_weight, :sort_order)
            RETURNING id, workout_id, name, machine, max_weight, sort_order
        ');
        $stmt->execute([
            'workout_id' => $workoutId,
            'name' => $name,
            'machine' => $machine,
            'max_weight' => $maxWeight,
            'sort_order' => $sortOrder,
        ]);

        $exercise = $stmt->fetch();
        insertBodyParts($db, $exercise['id'], $bodyPartIds);

        $db->commit();

        $exercise['body_parts'] = getExerciseBodyParts($db, $exercise['id']);

        echo json_encode($exercise);
        exit;
    }

    if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        $id = (int)($input['id'] ?? 0);
        $bodyPartIds = $input['body_part_ids'] ?? [];
        $name = trim($input['name'] ?? '');
        $machine = trim($input['machine'] ?? '') ?: null;
        $maxWeight = isset($input['max_weight']) && $input['max_weight'] !== '' ? (float)$input['max_weight'] : null;

        if (!$id || empty($bodyPartIds) || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'id, body_part_ids, and name are required']);
            exit;
        }

        $db->beginTransaction();

        $stmt = $db->prepare('
            UPDATE ll_exercises SET name = :name, machine = :machine, max_weight = :max_weight
            WHERE id = :id
            RETURNING id, workout_id, name, machine, max_weight, sort_order
        ');
        $stmt->execute([
            'id' => $id,
            'name' => $name,
            'machine' => $machine,
            'max_weight' => $maxWeight,
        ]);

        $exercise = $stmt->fetch();

        if (!$exercise) {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Exercise not found']);
            exit;
        }

        // Replace body parts
        $db->prepare('DELETE FROM ll_exercise_body_parts WHERE exercise_id = :id')->execute(['id' => $id]);
        insertBodyParts($db, $id, $bodyPartIds);

        $db->commit();

        $exercise['body_parts'] = getExerciseBodyParts($db, $id);

        echo json_encode($exercise);
        exit;
    }

    if ($method === 'GET') {
        $search = trim($_GET['search'] ?? '');

        if ($search === '') {
            echo json_encode([]);
            exit;
        }

        $pattern = '%' . $search . '%';

        $stmt = $db->prepare('
            SELECT sub.name, sub.max_weight, sub.last_date
            FROM (
                SELECT DISTINCT ON (e.name)
                    e.name,
                    e.max_weight,
                    w.started_at AS last_date
                FROM ll_exercises e
                JOIN ll_workouts w ON w.id = e.workout_id
                WHERE e.name ILIKE :pattern
                ORDER BY e.name, w.started_at DESC
            ) sub
            ORDER BY sub.name
            LIMIT 10
        ');
        $stmt->execute(['pattern' => $pattern]);

        echo json_encode($stmt->fetchAll());
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
