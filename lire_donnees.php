<?php
// ============================================================
//  HydroMind — lire_donnees.php
//  Renvoie les 30 dernières mesures, l'état système, le régime de débit,
//  les stats d'eau économisée et les dernières notifications envoyées.
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/regime.php';

// ── Headers CORS ─────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Helpers ──────────────────────────────────────────────────

function jsonError(string $message, int $code = 500): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

// ── Requêtes ─────────────────────────────────────────────────

try {
    $pdo = getPDO();

    // 1. Calcul du régime actuel (met aussi à jour l'expiration d'événement si dépassée)
    $regimeInfo = calculerRegime($pdo);
    $coefActif  = (float) $regimeInfo['coef'];

    // 2. État système (vanne + mode nuit + état alerte + régime)
    $stmtEtat = $pdo->query(
        'SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte,
                DATE_FORMAT(alerte_depuis, \'%Y-%m-%d %H:%i:%s\') AS alerte_depuis,
                prediction_active,
                DATE_FORMAT(prediction_depuis, \'%Y-%m-%d %H:%i:%s\') AS prediction_depuis,
                prediction_eta_min,
                prediction_pente,
                mode_regime,
                DATE_FORMAT(evenement_jusqu_a, \'%Y-%m-%d %H:%i:%s\') AS evenement_jusqu_a,
                ouverture_manuelle,
                ouverture_pct
         FROM etat_systeme WHERE id = 1'
    );
    $etat = $stmtEtat->fetch();

    if (!$etat) {
        jsonError('Table etat_systeme vide.');
    }

    // 3. Les 30 dernières mesures, remises dans l'ordre chronologique
    $stmtData = $pdo->query(
        'SELECT id,
                DATE_FORMAT(timestamp, \'%Y-%m-%d %H:%i:%s\') AS timestamp,
                debit_eau,
                debit_evite,
                COALESCE(debit_brut, debit_eau + debit_evite) AS debit_brut,
                ouverture_pct,
                alerte_fuite
         FROM (
             SELECT id, timestamp, debit_eau, debit_evite, debit_brut, ouverture_pct, alerte_fuite
             FROM consommation
             ORDER BY id DESC
             LIMIT 30
         ) AS sub
         ORDER BY id ASC'
    );
    $mesures = $stmtData->fetchAll();

    // Dernier débit brut (demande mesurée par le capteur)
    $dernierDebitBrut = 0.0;
    if (count($mesures) > 0) {
        $derniereMesure = $mesures[count($mesures) - 1];
        $dernierDebitBrut = (float) $derniereMesure['debit_brut'];
    }

    // 3b. Secondes écoulées depuis la dernière mesure (calcul SQL TIMESTAMPDIFF)
    $stmtDiff = $pdo->query(
        'SELECT TIMESTAMPDIFF(SECOND, MAX(timestamp), NOW()) AS seconds_since_last_reading FROM consommation'
    );
    $diffRow = $stmtDiff->fetch();
    $secondsSinceLastReading = ($diffRow && $diffRow['seconds_since_last_reading'] !== null)
        ? max(0, (int) $diffRow['seconds_since_last_reading'])
        : null;

    // 4. Statistiques rapides
    $debits     = array_column($mesures, 'debit_eau');
    $nbAlertes  = (int) array_sum(array_column($mesures, 'alerte_fuite'));
    $debitMoyen = count($debits) ? round(array_sum($debits) / count($debits), 2) : 0;
    $debitMax   = count($debits) ? round(max($debits), 2) : 0;

    // Seuil actif ajusté par le coef
    $baseSeuil  = $etat['mode_nuit'] ? SEUIL_NUIT : SEUIL_JOUR;
    $seuilActif = round($baseSeuil * $coefActif, 2);

    // 5. Calcul réel de l'eau économisée et de la consommation réelle (Litres) depuis aujourd'hui 00:00
    //    Règle physique : Somme(debit * Δt_min)
    //    Δt = temps écoulé depuis la mesure précédente, plafonné à 10 s
    $stmtEco = $pdo->query(
        'SELECT id,
                UNIX_TIMESTAMP(timestamp) AS ts_sec,
                debit_eau,
                debit_evite
         FROM consommation
         WHERE timestamp >= CURDATE()
         ORDER BY id ASC'
    );
    $rowsEco = $stmtEco->fetchAll();

    $eauEconomisee    = 0.0;
    $consommationJour = 0.0;
    $prevTs = null;

    foreach ($rowsEco as $row) {
        $currTs     = (float) $row['ts_sec'];
        $debitEau   = (float) $row['debit_eau'];
        $debitEvite = (float) $row['debit_evite'];

        if ($prevTs !== null) {
            $deltaSec = $currTs - $prevTs;
            if ($deltaSec < 0) {
                $deltaSec = 0.0;
            } elseif ($deltaSec > 10.0) {
                $deltaSec = 10.0;
            } elseif ($deltaSec == 0.0 && ($debitEvite > 0 || $debitEau > 0)) {
                $deltaSec = 1.0;
            }

            $deltaMin = $deltaSec / 60.0;
            if ($debitEvite > 0 && $deltaMin > 0) {
                $eauEconomisee += $debitEvite * $deltaMin;
            }
            if ($debitEau > 0 && $deltaMin > 0) {
                $consommationJour += $debitEau * $deltaMin;
            }
        }
        $prevTs = $currTs;
    }

    $eauEconomisee    = round($eauEconomisee, 2);
    $consommationJour = round($consommationJour, 2);

    // 6. Récupérer les alertes du jour & l'historique alertes_log
    $alertesAujourdhui    = 0;
    $fermeturesAujourdhui = 0;
    $alertesLog           = [];
    try {
        $stmtStatsAlertes = $pdo->query(
            "SELECT 
                COUNT(CASE WHEN etat IN ('ALERTE', 'FERMEE') THEN 1 END) AS alertes_aujourdhui,
                COUNT(CASE WHEN etat = 'FERMEE' THEN 1 END) AS fermetures_aujourdhui
             FROM alertes_log
             WHERE created_at >= CURDATE()"
        );
        $rowStats = $stmtStatsAlertes->fetch();
        if ($rowStats) {
            $alertesAujourdhui    = (int) ($rowStats['alertes_aujourdhui'] ?? 0);
            $fermeturesAujourdhui = (int) ($rowStats['fermetures_aujourdhui'] ?? 0);
        }

        $stmtAlertes = $pdo->query(
            'SELECT id, etat, type, debit, DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') AS created_at
             FROM alertes_log
             ORDER BY id DESC
             LIMIT 10'
        );
        $alertesLog = $stmtAlertes->fetchAll();
    } catch (Exception $e) {}

    // 7. Récupérer les 5 dernières notifications envoyées
    $dernieresNotifications = [];
    try {
        $stmtNotifs = $pdo->query(
            'SELECT canal, destinataire, statut, DATE_FORMAT(date_envoi, \'%H:%i:%s\') AS heure
             FROM notifications_log
             ORDER BY id DESC
             LIMIT 5'
        );
        $dernieresNotifications = $stmtNotifs->fetchAll();
    } catch (Exception $e) {}

    // 8. Réponse JSON complète
    echo json_encode([
        'success'                    => true,
        'seconds_since_last_reading' => $secondsSinceLastReading,
        'statut_vanne'               => $etat['statut_vanne'],
        'mode_nuit'                  => (bool) $etat['mode_nuit'],
        'etat_alerte'                => $etat['etat_alerte'] ?? 'NORMAL',
        'type_alerte'                => $etat['type_alerte'] ?? null,
        'alerte_depuis'              => $etat['alerte_depuis'] ?? null,
        'prediction_active'          => (int) ($etat['prediction_active'] ?? 0),
        'prediction_depuis'          => $etat['prediction_depuis'] ?? null,
        'prediction_eta_min'         => ($etat['prediction_eta_min'] !== null) ? (float) $etat['prediction_eta_min'] : null,
        'prediction_pente'           => ($etat['prediction_pente'] !== null) ? (float) $etat['prediction_pente'] : null,
        'mode_regime'                => $etat['mode_regime'] ?? 'NORMAL',
        'evenement_jusqu_a'          => $etat['evenement_jusqu_a'] ?? null,
        'ouverture_pct'              => (int) ($regimeInfo['ouverture_pct'] ?? 100),
        'ouverture_manuelle'         => ($etat['ouverture_manuelle'] !== null) ? (int) $etat['ouverture_manuelle'] : null,
        'debit_brut'                 => $dernierDebitBrut,
        'coef'                       => $coefActif,
        'regime'                     => $regimeInfo['regime'] ?? 'NORMAL',
        'seuil_actif'                => $seuilActif,
        'alertes_log'                => $alertesLog,
        'stats'                      => [
            'seconds_since_last_reading' => $secondsSinceLastReading,
            'nb_mesures'                 => count($mesures),
            'nb_alertes'                 => $nbAlertes,
            'debit_moyen'                => $debitMoyen,
            'debit_max'                  => $debitMax,
            'eau_economisee'             => $eauEconomisee,
            'consommation_jour'          => $consommationJour,
            'alertes_aujourdhui'         => $alertesAujourdhui,
            'fermetures_aujourdhui'      => $fermeturesAujourdhui,
        ],
        'notifications'              => $dernieresNotifications,
        'mesures'                    => $mesures,
    ]);

} catch (PDOException $e) {
    jsonError('Erreur base de données : ' . $e->getMessage());
}
