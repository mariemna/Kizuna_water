<?php
// ============================================================
//  HydroMind — auth.php
//  Gestion des sessions techniciens et helpers d'authentification
// ============================================================

require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Retourne les données du technicien connecté ou null.
 */
function getLoggedInWorker(): ?array
{
    return $_SESSION['worker'] ?? null;
}

/**
 * Vérifie si un technicien est connecté.
 */
function isWorkerLoggedIn(): bool
{
    return !empty($_SESSION['worker']);
}

/**
 * Exige une authentification pour les requêtes protégées.
 * Renvoie une erreur JSON 401 si non connecté.
 */
function requireWorkerAuth(): array
{
    $worker = getLoggedInWorker();
    if (!$worker) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Authentication required. Please sign in.'
        ]);
        exit;
    }
    return $worker;
}

/**
 * Formate un tableau worker sécurisé pour les réponses JSON.
 */
function sanitizeWorker(array $row): array
{
    unset($row['password_hash']);
    $row['id'] = (int) $row['id'];
    $row['notify_sms'] = (int) $row['notify_sms'];
    $row['notify_telegram'] = (int) $row['notify_telegram'];
    return $row;
}

// ── Point d'entrée direct pour vérifier l'état de session ─────
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'auth.php') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: true');

    $worker = getLoggedInWorker();
    echo json_encode([
        'success'       => true,
        'authenticated' => ($worker !== null),
        'worker'        => $worker
    ]);
    exit;
}
