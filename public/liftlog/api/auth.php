<?php

session_set_cookie_params([
    'lifetime' => 604800,
    'path' => '/liftlog/',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../api/db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(['authenticated' => !empty($_SESSION['liftlog_authenticated'])]);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $pin = $input['pin'] ?? '';

    $envFile = __DIR__ . '/../../../.env';
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with($line, '#')) continue;
            putenv($line);
        }
    }

    $hash = getenv('LIFTLOG_PIN_HASH');

    if ($hash && password_verify($pin, $hash)) {
        $_SESSION['liftlog_authenticated'] = true;
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid PIN']);
    }
    exit;
}

if ($method === 'DELETE') {
    session_destroy();
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
