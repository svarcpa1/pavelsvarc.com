<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/db.php';

try {
    $db = getDb();
    $stmt = $db->query('SELECT id, title, description, url, tags, sort_order FROM projects WHERE visible = true ORDER BY sort_order ASC, created_at DESC');
    $projects = $stmt->fetchAll();

    // Parse PostgreSQL array format for tags
    foreach ($projects as &$project) {
        $project['tags'] = parsePgArray($project['tags']);
    }

    echo json_encode($projects);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load projects']);
}

function parsePgArray(?string $pgArray): array {
    if ($pgArray === null || $pgArray === '{}') return [];
    $inner = trim($pgArray, '{}');
    return array_map(fn($v) => trim($v, '"'), explode(',', $inner));
}
