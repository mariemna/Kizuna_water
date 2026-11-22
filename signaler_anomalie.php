<?php
// ============================================================
//  HydroMind — signaler_anomalie.php
//  Reçoit un signalement d'anomalie IA (Python) ou externe,
//  met à jour l'état système / la vanne et déclenche les alertes.
//  Paramètres POST attendus :
//    - type   : type d'anomalie (ex: 'MNF', 'PIC', 'MICRO_FUITE')
//    - debit  : débit mesuré en L/min (float >= 0)
//    - action : 'ALERTE' (vanne reste ouverte) | 'FERMETURE' (vanne fermée)
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifier.php';

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

// ── Lecture des données (POST form-data ou JSON brut) ─────────
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$input = [];

if (str_contains($contentType, 'application/json')) {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $json = json_decode($rawInput, true);
        if (is_array($json)) {
            $input = $json;
        }
    }
} else {
    $input = $_POST;
    if (empty($input)) {
        $rawInput = file_get_contents('php://input');
        if (!empty($rawInput)) {
            $json = json_decode($rawInput, true);
            if (is_array($json)) {
                $input = $json;
            }
        }
    }
}

// Paramètres de secours via $_GET si besoin
if (empty($input)) {
    $input = $_GET;
}

$type     = isset($input['type']) ? trim((string) $input['type']) : null;
$action   = isset($input['action']) ? strtoupper(trim((string) $input['action'])) : null;
$rawDebit = $input['debit'] ?? null;

if (!in_array($action, ['ALERTE', 'FERMETURE', 'PREDICTION', 'PREDICTION_FIN'], true)) {
    jsonError('Invalid "action" parameter ("ALERTE", "FERMETURE", "PREDICTION" or "PREDICTION_FIN" expected).');
}

if ($action !== 'PREDICTION_FIN' && empty($type) && $action !== 'PREDICTION') {
    jsonError('Missing "type" parameter.');
}
if ($action === 'PREDICTION' && empty($type)) {
    $type = 'PREDICTION';
}

$debit = 0.0;
if ($action !== 'PREDICTION_FIN') {
    $debitVal = filter_var($rawDebit, FILTER_VALIDATE_FLOAT);
    if ($debitVal === false || $debitVal < 0) {
        jsonError('Invalid "debit" parameter (number >= 0 expected).');
    }
    $debit = (float) $debitVal;
}

try {
    $pdo = getPDO();

    // 1. Lire l'état actuel
    $stmt = $pdo->query('SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte, alerte_depuis, prediction_active FROM etat_systeme WHERE id = 1');
    $etat = $stmt->fetch();

    if (!$etat) {
        jsonError('System state table is empty.', 500);
    }

    $notifResults = null;

    // 2. Traitement selon l'action demandée
    if ($action === 'PREDICTION') {
        // R6 PREDICTION : avertissement statistique préventif
        // NE CHANGE JAMAIS l'état d'alerte et NE TOUCHE JAMAIS à la vanne
        $pente   = isset($input['pente']) ? (float) $input['pente'] : 0.0;
        $r2      = isset($input['r2']) ? (float) $input['r2'] : 0.0;
        $eta_min = isset($input['eta_min']) ? (float) $input['eta_min'] : 0.0;
        $cible   = isset($input['cible']) ? (float) $input['cible'] : (defined('SEUIL_JOUR') ? SEUIL_JOUR : 5.0);
        $mode    = isset($input['mode']) ? (string) $input['mode'] : 'day';

        $predRes = notifierPrediction($pdo, [
            'debit'   => $debit,
            'pente'   => $pente,
            'r2'      => $r2,
            'eta_min' => $eta_min,
            'cible'   => $cible,
            'mode'    => $mode,
        ]);
        $notifResults = $predRes['notifications'] ?? null;

    } elseif ($action === 'PREDICTION_FIN') {
        // Arrêt silencieux de la prédiction active
        notifierPredictionFin($pdo);

    } elseif ($action === 'FERMETURE') {
        // Fermer physiquement la vanne dans l'état système
        if ($etat['statut_vanne'] !== 'FERMEE') {
            $pdo->exec("UPDATE etat_systeme SET statut_vanne = 'FERMEE' WHERE id = 1");
        }
        $trans = changerEtatAlerte($pdo, 'FERMEE', $type, (float) $debit);
        $notifResults = $trans['notifications'] ?? null;
    } else { // 'ALERTE'
        // La vanne reste ouverte ; si le système n'est pas déjà en coupure d'urgence, passage en ALERTE
        if ($etat['etat_alerte'] !== 'FERMEE') {
            $trans = changerEtatAlerte($pdo, 'ALERTE', $type, (float) $debit);
            $notifResults = $trans['notifications'] ?? null;
        }
    }

    // 3. Relire l'état final à jour
    $stmtFresh = $pdo->query(
        'SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte,
                DATE_FORMAT(alerte_depuis, \'%Y-%m-%d %H:%i:%s\') AS alerte_depuis,
                prediction_active,
                DATE_FORMAT(prediction_depuis, \'%Y-%m-%d %H:%i:%s\') AS prediction_depuis,
                prediction_eta_min,
                prediction_pente
         FROM etat_systeme WHERE id = 1'
    );
    $etatFresh = $stmtFresh->fetch();

    echo json_encode([
        'success'           => true,
        'action'            => $action,
        'type'              => $type,
        'debit'             => (float) $debit,
        'statut_vanne'      => $etatFresh['statut_vanne'],
        'etat_alerte'       => $etatFresh['etat_alerte'],
        'type_alerte'       => $etatFresh['type_alerte'],
        'alerte_depuis'     => $etatFresh['alerte_depuis'],
        'prediction_active' => (int) ($etatFresh['prediction_active'] ?? 0),
        'prediction_eta_min'=> ($etatFresh['prediction_eta_min'] !== null) ? (float) $etatFresh['prediction_eta_min'] : null,
        'prediction_pente'  => ($etatFresh['prediction_pente'] !== null) ? (float) $etatFresh['prediction_pente'] : null,
        'notifications'     => $notifResults,
    ]);

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
