<?php
// ============================================================
//  HydroMind — logout.php
//  Déconnexion de la session technicien
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$_SESSION['worker'] = null;
unset($_SESSION['worker']);

if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
}

// Redirection si demandé par lien direct
if (isset($_GET['redirect'])) {
    header('Location: ' . filter_var($_GET['redirect'], FILTER_SANITIZE_URL));
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

echo json_encode([
    'success' => true,
    'message' => 'Sign-out successful.'
]);
