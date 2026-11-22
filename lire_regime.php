<?php
// ============================================================
//  HydroMind — lire_regime.php
//  Point de terminaison léger pour obtenir le régime et le coef actif
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/regime.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    $pdo = getPDO();
    $res = calculerRegime($pdo);

    $stmtSys = $pdo->query('SELECT mode_regime, evenement_jusqu_a, ouverture_manuelle, mode_nuit, statut_vanne FROM etat_systeme WHERE id = 1');
    $sys = $stmtSys->fetch() ?: [];

    echo json_encode([
        'success'            => true,
        'ouverture_pct'      => $res['ouverture_pct'],
        'regime'             => $res['regime'],
        'coef'               => $res['coef'],
        'mode_regime'        => $sys['mode_regime'] ?? 'NORMAL',
        'evenement_jusqu_a'  => $sys['evenement_jusqu_a'] ?? null,
        'ouverture_manuelle' => $sys['ouverture_manuelle'] ?? null,
        'mode_nuit'          => (bool) ($sys['mode_nuit'] ?? false),
        'statut_vanne'       => $sys['statut_vanne'] ?? 'OUVERTE',
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
