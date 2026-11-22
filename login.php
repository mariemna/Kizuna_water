<?php
// ============================================================
//  HydroMind — login.php
//  Connexion sécurisée du technicien
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed (POST required).']);
    exit;
}

// ── Lecture du corps (JSON ou form-data) ──────────────────────
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (str_contains($contentType, 'application/json')) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
} else {
    $input = $_POST;
}

$email = strtolower(trim((string) ($input['email'] ?? '')));
$password = (string) ($input['password'] ?? '');

if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please enter your email and password.']);
    exit;
}

try {
    $pdo = getPDO();

    $stmt = $pdo->prepare('SELECT * FROM workers WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $worker = $stmt->fetch();

    if (!$worker || !password_verify($password, $worker['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Incorrect email or password.']);
        exit;
    }

    $workerSafe = sanitizeWorker($worker);
    $_SESSION['worker'] = $workerSafe;

    echo json_encode([
        'success' => true,
        'message' => 'Sign-in successful. Welcome ' . $workerSafe['nom_complet'] . '!',
        'worker'  => $workerSafe
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur base de données : ' . $e->getMessage()]);
}
