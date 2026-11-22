<?php
// ============================================================
//  HydroMind — register.php
//  Création de compte technicien avec préférences d'alerte
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

// ── Validation des champs ─────────────────────────────────────
$nom = trim((string) ($input['nom_complet'] ?? ''));
$email = strtolower(trim((string) ($input['email'] ?? '')));
$telephone = trim((string) ($input['telephone'] ?? ''));
$telegramChatId = trim((string) ($input['telegram_chat_id'] ?? ''));
$secteur = trim((string) ($input['secteur_assigne'] ?? DEFAULT_SECTOR_NAME));
$password = (string) ($input['password'] ?? '');

$notifySms = isset($input['notify_sms']) ? (int) (bool) $input['notify_sms'] : 0;
$notifyTelegram = isset($input['notify_telegram']) ? (int) (bool) $input['notify_telegram'] : 1;

if (empty($nom)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Full name is required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email address.']);
    exit;
}

if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password must contain at least 6 characters.']);
    exit;
}

if (empty($telephone)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'A phone number is required for SMS alerts.']);
    exit;
}

try {
    $pdo = getPDO();

    // Vérifier si l'email existe déjà
    $stmtCheck = $pdo->prepare('SELECT id FROM workers WHERE email = :email LIMIT 1');
    $stmtCheck->execute([':email' => $email]);
    if ($stmtCheck->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This email address is already registered.']);
        exit;
    }

    // Hasher le mot de passe
    $hash = password_hash($password, PASSWORD_BCRYPT);

    $stmtInsert = $pdo->prepare(
        'INSERT INTO workers (nom_complet, email, telephone, telegram_chat_id, secteur_assigne, notify_sms, notify_telegram, password_hash)
         VALUES (:nom, :email, :tel, :telegram, :secteur, :sms, :tg, :hash)'
    );

    $stmtInsert->execute([
        ':nom'      => $nom,
        ':email'    => $email,
        ':tel'      => $telephone,
        ':telegram' => !empty($telegramChatId) ? $telegramChatId : null,
        ':secteur'  => !empty($secteur) ? $secteur : DEFAULT_SECTOR_NAME,
        ':sms'      => $notifySms,
        ':tg'       => $notifyTelegram,
        ':hash'     => $hash,
    ]);

    $newId = (int) $pdo->lastInsertId();

    $stmtGet = $pdo->prepare('SELECT * FROM workers WHERE id = :id');
    $stmtGet->execute([':id' => $newId]);
    $workerRow = $stmtGet->fetch();

    $workerSafe = sanitizeWorker($workerRow);
    $_SESSION['worker'] = $workerSafe;

    echo json_encode([
        'success' => true,
        'message' => 'Technician account created successfully!',
        'worker'  => $workerSafe
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur base de données : ' . $e->getMessage()]);
}
