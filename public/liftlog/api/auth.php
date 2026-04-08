<?php

session_set_cookie_params([
    'lifetime' => 604800,
    'path' => '/liftlog/',
    'httponly' => true,
    'secure' => true,
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
    // Rate limiting: max 5 attempts per 5 minutes
    $now = time();
    $window = 300; // 5 minutes
    $maxAttempts = 5;

    if (!isset($_SESSION['login_attempts'])) {
        $_SESSION['login_attempts'] = [];
    }

    // Remove attempts older than the window
    $_SESSION['login_attempts'] = array_filter(
        $_SESSION['login_attempts'],
        fn($t) => $t > $now - $window
    );

    if (count($_SESSION['login_attempts']) >= $maxAttempts) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many attempts. Try again in a few minutes.']);
        exit;
    }

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
        $_SESSION['login_attempts'] = []; // Reset on success
        echo json_encode(['ok' => true]);
    } else {
        $_SESSION['login_attempts'][] = $now;
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
