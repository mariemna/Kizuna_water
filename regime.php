<?php
// ============================================================
//  HydroMind — regime.php
//  Gestion des régimes d'exploitation hydraulique & calcul d'ouverture
// ============================================================

require_once __DIR__ . '/config.php';

/**
 * Calcule l'ouverture de la vanne (%), le régime effectif et le coefficient multiplicateur.
 *
 * Ordre de priorité strict :
 *  1. Vanne FERMÉE -> ouverture_pct = 0
 *  2. Dérogation manuelle (ouverture_manuelle != NULL) -> ouverture_pct = ouverture_manuelle (10-100%)
 *  3. EVENEMENT actif (mode_regime = EVENEMENT et (evenement_jusqu_a IS NULL ou > NOW()))
 *     -> ouverture_pct = 100, coef = coef_evenement (1.5). Si expiré -> retour auto à NORMAL (coef=1, ouv=100)
 *  4. ECO_NUIT actif et mode_nuit = 1 -> ouverture_pct = eco_nuit_pct (60%), coef = 1.0
 *  5. Sinon (NORMAL ou ECO_NUIT de jour) -> ouverture_pct = 100, coef = 1.0
 *
 * @param PDO $pdo
 * @return array ['ouverture_pct' => int, 'regime' => string, 'coef' => float]
 */
function calculerRegime(PDO $pdo): array
{
    // 1. Lire l'état actuel du système
    $stmt = $pdo->query(
        'SELECT statut_vanne, mode_nuit, mode_regime, evenement_jusqu_a, ouverture_manuelle, ouverture_pct
         FROM etat_systeme WHERE id = 1'
    );
    $etat = $stmt->fetch();

    if (!$etat) {
        return [
            'ouverture_pct' => 100,
            'regime'        => 'NORMAL',
            'coef'          => 1.0,
        ];
    }

    // 2. Paramètres du secteur (profils_secteur avec fallback config.php)
    $sectorName    = defined('DEFAULT_SECTOR_NAME') ? DEFAULT_SECTOR_NAME : 'Sector A — ESPRIT Zone / El Ghazala';
    $ecoNuitPct    = defined('ECO_NUIT_PCT') ? (int) ECO_NUIT_PCT : 60;
    $coefEvenement = defined('EVENT_COEF') ? (float) EVENT_COEF : 1.5;

    try {
        $stmtSector = $pdo->prepare(
            'SELECT eco_nuit_pct, coef_evenement FROM profils_secteur WHERE secteur = :s LIMIT 1'
        );
        $stmtSector->execute([':s' => $sectorName]);
        $sectorRow = $stmtSector->fetch();
        if ($sectorRow) {
            if (isset($sectorRow['eco_nuit_pct'])) {
                $ecoNuitPct = (int) $sectorRow['eco_nuit_pct'];
            }
            if (isset($sectorRow['coef_evenement'])) {
                $coefEvenement = (float) $sectorRow['coef_evenement'];
            }
        }
    } catch (Exception $e) {}

    $modeRegime      = strtoupper(trim((string) ($etat['mode_regime'] ?? 'NORMAL')));
    $evenementJusquA = $etat['evenement_jusqu_a'] ?? null;
    $modeNuit        = !empty($etat['mode_nuit']);
    $now             = date('Y-m-d H:i:s');

    // 3. Détermination du régime et du coefficient
    $regime  = 'NORMAL';
    $coef    = 1.0;
    $autoPct = 100;

    if ($modeRegime === 'EVENEMENT') {
        $estActif = true;
        if (!empty($evenementJusquA) && $evenementJusquA <= $now) {
            $estActif = false;
        }

        if ($estActif) {
            $regime  = 'EVENEMENT';
            $coef    = $coefEvenement;
            $autoPct = 100;
        } else {
            // Expiré : bascule automatiquement en NORMAL
            $regime  = 'NORMAL';
            $coef    = 1.0;
            $autoPct = 100;
            try {
                $pdo->exec("UPDATE etat_systeme SET mode_regime = 'NORMAL', evenement_jusqu_a = NULL WHERE id = 1");
            } catch (Exception $e) {}
        }
    } elseif ($modeRegime === 'ECO_NUIT') {
        $regime = 'ECO_NUIT';
        $coef   = 1.0;
        if ($modeNuit) {
            $autoPct = $ecoNuitPct;
        } else {
            $autoPct = 100;
        }
    } else {
        $regime  = 'NORMAL';
        $coef    = 1.0;
        $autoPct = 100;
    }

    // 4. Détermination de ouverture_pct selon la priorité
    $statutVanne = strtoupper(trim((string) ($etat['statut_vanne'] ?? 'OUVERTE')));
    $ouvertureManuelle = $etat['ouverture_manuelle'] ?? null;

    if ($statutVanne === 'FERMEE') {
        $ouverturePct = 0;
    } elseif ($ouvertureManuelle !== null && $ouvertureManuelle !== '') {
        $ouverturePct = max(10, min(100, (int) $ouvertureManuelle));
    } else {
        $ouverturePct = $autoPct;
    }

    // 5. Synchroniser etat_systeme.ouverture_pct si différent
    if (!isset($etat['ouverture_pct']) || (int) $etat['ouverture_pct'] !== $ouverturePct) {
        try {
            $up = $pdo->prepare('UPDATE etat_systeme SET ouverture_pct = :pct WHERE id = 1');
            $up->execute([':pct' => $ouverturePct]);
        } catch (Exception $e) {}
    }

    return [
        'ouverture_pct' => (int) $ouverturePct,
        'regime'        => $regime,
        'coef'          => (float) $coef,
    ];
}

// ── Point d'entrée direct pour consultation JSON ───────────────
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'regime.php') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');

    try {
        $pdo = getPDO();
        $calcul = calculerRegime($pdo);

        $stmtSys = $pdo->query('SELECT mode_regime, evenement_jusqu_a, ouverture_manuelle FROM etat_systeme WHERE id = 1');
        $sys = $stmtSys->fetch() ?: [];

        echo json_encode([
            'success'            => true,
            'ouverture_pct'      => $calcul['ouverture_pct'],
            'regime'             => $calcul['regime'],
            'coef'               => $calcul['coef'],
            'mode_regime'        => $sys['mode_regime'] ?? 'NORMAL',
            'evenement_jusqu_a'  => $sys['evenement_jusqu_a'] ?? null,
            'ouverture_manuelle' => $sys['ouverture_manuelle'] ?? null,
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}
