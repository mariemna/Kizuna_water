<?php
// ============================================================
//  HydroMind — controler_vanne.php
//  Permet au tableau de bord de modifier :
//    - statut_vanne  : 'OUVERTE' | 'FERMEE'
//    - mode_nuit     : 0 | 1
//  Méthode : POST (application/x-www-form-urlencoded ou JSON)
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifier.php';
require_once __DIR__ . '/regime.php';

// ── Headers CORS ─────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Helpers ──────────────────────────────────────────────────

function jsonError(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// ── Lecture du corps (POST form-data OU JSON brut) ───────────

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

if (str_contains($contentType, 'application/json')) {
    // Corps JSON
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        jsonError('Invalid JSON body.');
    }
    $input = $body;
} else {
    // Form-data classique
    $input = $_POST;
}

// ── Validation & construction de la mise à jour ──────────────

$updates = [];
$params  = [];

// -- statut_vanne --
$isClosing = false;
$isReopening = false;

if (isset($input['statut_vanne'])) {
    $vanne = strtoupper(trim((string) $input['statut_vanne']));
    if (!in_array($vanne, ['OUVERTE', 'FERMEE'], true)) {
        jsonError('"statut_vanne" must be "OUVERTE" or "FERMEE".');
    }
    $updates[]        = 'statut_vanne = :vanne';
    $params[':vanne'] = $vanne;

    // Lire l'état actuel pour vérifier s'il s'agit d'une réelle réouverture depuis FERMEE
    $stmtCur = getPDO()->query('SELECT statut_vanne FROM etat_systeme WHERE id = 1');
    $curStatut = $stmtCur ? $stmtCur->fetchColumn() : 'OUVERTE';

    if ($vanne === 'FERMEE') {
        $isClosing = true;
        $updates[] = 'ouverture_pct = 0';
    } elseif ($vanne === 'OUVERTE') {
        if ($curStatut === 'FERMEE') {
            $isReopening = true;
            // La réouverture (FERMEE -> OUVERTE) réinitialise l'override manuel vers le régime automatique
            $updates[] = 'ouverture_manuelle = NULL';
        }
    }
}

// -- mode_nuit --
if (isset($input['mode_nuit'])) {
    $modeNuit = filter_var($input['mode_nuit'], FILTER_VALIDATE_INT);
    if ($modeNuit === false || !in_array($modeNuit, [0, 1], true)) {
        jsonError('"mode_nuit" must be 0 or 1.');
    }
    $updates[]            = 'mode_nuit = :mode_nuit';
    $params[':mode_nuit'] = $modeNuit;
}

// -- etat_alerte (optionnel, pour forcer un état) --
if (isset($input['etat_alerte'])) {
    $etatIn = strtoupper(trim((string) $input['etat_alerte']));
    if (!in_array($etatIn, ['NORMAL', 'ALERTE', 'FERMEE'], true)) {
        jsonError('"etat_alerte" must be "NORMAL", "ALERTE" or "FERMEE".');
    }
}

if (empty($updates) && !isset($input['etat_alerte'])) {
    jsonError('No valid parameters provided ("statut_vanne", "mode_nuit" or "etat_alerte" expected).');
}

// ── Mise à jour en base ───────────────────────────────────────

try {
    $pdo = getPDO();

    if (!empty($updates)) {
        $sql  = 'UPDATE etat_systeme SET ' . implode(', ', $updates) . ' WHERE id = 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    // Récupérer le dernier débit mesuré pour les notifications
    $stmtLastDebit = $pdo->query('SELECT COALESCE(debit_brut, debit_eau) AS debit FROM consommation ORDER BY id DESC LIMIT 1');
    $rowDebit = $stmtLastDebit->fetch();
    $dernierDebit = $rowDebit ? (float) $rowDebit['debit'] : 0.0;

    $notifResults = null;

    // Règle : Réouverture de la vanne -> retour automatique à l'état NORMAL
    if ($isReopening) {
        $trans = changerEtatAlerte($pdo, 'NORMAL', null, $dernierDebit);
        $notifResults = $trans['notifications'] ?? null;
    } elseif (isset($input['etat_alerte'])) {
        $trans = changerEtatAlerte(
            $pdo,
            strtoupper(trim((string) $input['etat_alerte'])),
            isset($input['type_alerte']) ? trim((string) $input['type_alerte']) : null,
            $dernierDebit
        );
        $notifResults = $trans['notifications'] ?? null;
    }

    // Recalculer le régime et l'ouverture effective
    $regimeInfo = calculerRegime($pdo);

    // Relire l'état à jour pour le confirmer dans la réponse
    $etat = $pdo->query(
        'SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte,
                DATE_FORMAT(alerte_depuis, \'%Y-%m-%d %H:%i:%s\') AS alerte_depuis,
                mode_regime, evenement_jusqu_a, ouverture_manuelle, ouverture_pct
         FROM etat_systeme WHERE id = 1'
    )->fetch();

    echo json_encode([
        'success'            => true,
        'message'            => 'System status updated.',
        'statut_vanne'       => $etat['statut_vanne'],
        'mode_nuit'          => (bool) $etat['mode_nuit'],
        'etat_alerte'        => $etat['etat_alerte'],
        'type_alerte'        => $etat['type_alerte'],
        'alerte_depuis'      => $etat['alerte_depuis'],
        'mode_regime'        => $etat['mode_regime'],
        'evenement_jusqu_a'  => $etat['evenement_jusqu_a'],
        'ouverture_manuelle' => $etat['ouverture_manuelle'],
        'ouverture_pct'      => $regimeInfo['ouverture_pct'],
        'regime'             => $regimeInfo['regime'],
        'coef'               => $regimeInfo['coef'],
        'notifications'      => $notifResults,
    ]);

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
