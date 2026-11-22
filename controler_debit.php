<?php
// ============================================================
//  HydroMind — controler_debit.php
//  Gestion du contrôle de débit : régimes et ouverture de vanne
//  Méthode : POST (Session technicien requise)
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/regime.php';

// ── Headers CORS & JSON ──────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed (POST expected).', 405);
}

// ── Vérification de la session technicien ────────────────────
if (!isWorkerLoggedIn()) {
    jsonError('Authentication required. Please sign in.', 401);
}

// ── Lecture du corps (POST form-data ou JSON brut) ───────────
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (str_contains($contentType, 'application/json')) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        jsonError('Invalid JSON body.');
    }
} else {
    $input = $_POST;
}

// ── Validation des paramètres ────────────────────────────────

// 1. regime (NORMAL | ECO_NUIT | EVENEMENT)
if (!isset($input['regime'])) {
    jsonError('Missing "regime" parameter ("NORMAL", "ECO_NUIT" or "EVENEMENT" expected).');
}
$regimeInput = strtoupper(trim((string) $input['regime']));
if (!in_array($regimeInput, ['NORMAL', 'ECO_NUIT', 'EVENEMENT'], true)) {
    jsonError('Invalid "regime" parameter ("NORMAL", "ECO_NUIT" or "EVENEMENT" expected).');
}

// 2. duree_heures (optionnel, uniquement pour EVENEMENT, entre 1 et 72 heures)
$evenementJusquA = null;
if ($regimeInput === 'EVENEMENT') {
    if (isset($input['duree_heures']) && $input['duree_heures'] !== '' && $input['duree_heures'] !== null) {
        $duree = filter_var($input['duree_heures'], FILTER_VALIDATE_FLOAT);
        if ($duree === false || $duree < 1 || $duree > 72) {
            jsonError('Invalid "duree_heures" parameter (number between 1 and 72 expected).');
        }
        $evenementJusquA = date('Y-m-d H:i:s', time() + (int) round($duree * 3600));
    } else {
        $evenementJusquA = null; // Illimité jusqu'à désactivation manuelle
    }
} else {
    $evenementJusquA = null;
}

// 3. ouverture (10–100 ou 'auto' ; 0 n'est pas autorisé ici, utiliser le bouton fermer)
$ouvertureManuelle = null;
if (isset($input['ouverture'])) {
    $ouvRaw = trim((string) $input['ouverture']);
    if (strtolower($ouvRaw) === 'auto' || $ouvRaw === '') {
        $ouvertureManuelle = null;
    } else {
        $ouvVal = filter_var($ouvRaw, FILTER_VALIDATE_INT);
        if ($ouvVal === 0 || $ouvRaw === '0') {
            jsonError('Opening 0% is not allowed here. Use the close button to shut the valve.');
        }
        if ($ouvVal === false || $ouvVal < 10 || $ouvVal > 100) {
            jsonError('Invalid "ouverture" parameter (integer between 10 and 100, or "auto" expected).');
        }
        $ouvertureManuelle = $ouvVal;
    }
}

// ── Mise à jour en base de données ───────────────────────────
try {
    $pdo = getPDO();

    $stmt = $pdo->prepare(
        'UPDATE etat_systeme
         SET mode_regime        = :regime,
             evenement_jusqu_a  = :evenement,
             ouverture_manuelle = :manuelle
         WHERE id = 1'
    );
    $stmt->execute([
        ':regime'   => $regimeInput,
        ':evenement'=> $evenementJusquA,
        ':manuelle' => $ouvertureManuelle,
    ]);

    // Recalculer immédiatement le régime effectif
    $calcul = calculerRegime($pdo);

    echo json_encode([
        'success'            => true,
        'message'            => 'Flow control parameters updated.',
        'mode_regime'        => $regimeInput,
        'evenement_jusqu_a'  => $evenementJusquA,
        'ouverture_manuelle' => $ouvertureManuelle,
        'ouverture_pct'      => $calcul['ouverture_pct'],
        'regime'             => $calcul['regime'],
        'coef'               => $calcul['coef'],
    ]);

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
