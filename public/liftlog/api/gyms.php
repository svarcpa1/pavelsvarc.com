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

try {
    $db = getDb();
    $stmt = $db->query('SELECT id, name FROM ll_gyms ORDER BY sort_order ASC');
    echo json_encode($stmt->fetchAll());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load gyms']);
}
