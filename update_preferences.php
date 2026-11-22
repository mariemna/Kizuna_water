<?php
// ============================================================
//  HydroMind — update_preferences.php
//  Mise à jour des canaux et coordonnées d'alerte du technicien
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

// Vérifier l'authentification
$currentWorker = requireWorkerAuth();
$workerId = (int) $currentWorker['id'];

// ── Lecture du corps (JSON ou form-data) ──────────────────────
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (str_contains($contentType, 'application/json')) {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
} else {
    $input = $_POST;
}

$telephone = isset($input['telephone']) ? trim((string) $input['telephone']) : $currentWorker['telephone'];
$telegramChatId = isset($input['telegram_chat_id']) ? trim((string) $input['telegram_chat_id']) : $currentWorker['telegram_chat_id'];
$secteur = isset($input['secteur_assigne']) ? trim((string) $input['secteur_assigne']) : $currentWorker['secteur_assigne'];
$nomComplet = isset($input['nom_complet']) ? trim((string) $input['nom_complet']) : $currentWorker['nom_complet'];

$notifySms = isset($input['notify_sms']) ? (int) (bool) $input['notify_sms'] : $currentWorker['notify_sms'];
$notifyTelegram = isset($input['notify_telegram']) ? (int) (bool) $input['notify_telegram'] : $currentWorker['notify_telegram'];

// Validation minimale : si SMS activé, le téléphone ne doit pas être vide
if ($notifySms && empty($telephone)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please enter a phone number to enable SMS alerts.']);
    exit;
}

// Si Telegram activé, avertir si chat_id vide (ou laisser facultatif avec avertissement)
if ($notifyTelegram && empty($telegramChatId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Please enter a Telegram Chat ID to enable Telegram alerts.']);
    exit;
}

try {
    $pdo = getPDO();

    $stmt = $pdo->prepare(
        'UPDATE workers
         SET nom_complet      = :nom,
             telephone        = :tel,
             telegram_chat_id = :tg,
             secteur_assigne  = :secteur,
             notify_sms       = :sms,
             notify_telegram  = :notify_tg
         WHERE id = :id'
    );

    $stmt->execute([
        ':nom'       => !empty($nomComplet) ? $nomComplet : $currentWorker['nom_complet'],
        ':tel'       => $telephone,
        ':tg'        => !empty($telegramChatId) ? $telegramChatId : null,
        ':secteur'   => !empty($secteur) ? $secteur : DEFAULT_SECTOR_NAME,
        ':sms'       => $notifySms,
        ':notify_tg' => $notifyTelegram,
        ':id'        => $workerId,
    ]);

    // Relire la ligne à jour
    $stmtGet = $pdo->prepare('SELECT * FROM workers WHERE id = :id');
    $stmtGet->execute([':id' => $workerId]);
    $freshWorker = sanitizeWorker($stmtGet->fetch());

    $_SESSION['worker'] = $freshWorker;

    echo json_encode([
        'success' => true,
        'message' => 'Notification preferences saved successfully!',
        'worker'  => $freshWorker
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur base de données : ' . $e->getMessage()]);
}
