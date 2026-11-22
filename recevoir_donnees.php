<?php
// ============================================================
//  HydroMind — recevoir_donnees.php
//  Reçoit une mesure de débit (demande brute), applique le régime
//  hydraulique et l'ouverture de vanne, insère en base,
//  déclenche les alertes SMS/Telegram et renvoie l'état système.
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/notifier.php';
require_once __DIR__ . '/regime.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, ngrok-skip-browser-warning, User-Agent');

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

// ── Lecture du paramètre debit_eau (demande brute mesurée) ───

$raw = $_POST['debit_eau'] ?? $_GET['debit_eau'] ?? null;

if ($raw === null) {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $json = json_decode($rawInput, true);
        if (is_array($json) && isset($json['debit_eau'])) {
            $raw = $json['debit_eau'];
        }
    }
}

if ($raw === null) {
    jsonError('Missing "debit_eau" parameter.');
}

$debit = filter_var($raw, FILTER_VALIDATE_FLOAT);
if ($debit === false || $debit < 0) {
    jsonError('Invalid "debit_eau" parameter (number >= 0 expected).');
}

$debitBrut = (float) $debit; // La valeur reçue est la DEMANDE (brut)

// ── Logique hydraulique & Détection de fuite (Règles R1 & R2) ──

try {
    $pdo = getPDO();

    // 1. Calcul du régime actuel et de l'ouverture
    $regimeInfo = calculerRegime($pdo);
    $pct        = (int) $regimeInfo['ouverture_pct'];
    $regime     = $regimeInfo['regime'];
    $coef       = (float) $regimeInfo['coef'];

    // 2. Récupérer l'état système (vanne + mode nuit + état alerte)
    $stmt = $pdo->query('SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte, alerte_depuis FROM etat_systeme WHERE id = 1');
    $etat = $stmt->fetch();

    if (!$etat) {
        jsonError('etat_systeme table is empty. Check database.sql.', 500);
    }

    $statutVanne = strtoupper(trim((string) ($etat['statut_vanne'] ?? 'OUVERTE')));
    $baseSeuil   = $etat['mode_nuit'] ? SEUIL_NUIT : SEUIL_JOUR;
    $seuilActif  = round($baseSeuil * $coef, 3);
    $notifResults = null;

    // 3. Règle physique : vanne FERMÉE vs OUVERTE/PARTIELLE
    if ($statutVanne === 'FERMEE') {
        // Débit délivré physique nul, demande brute stockée, totalité en débit évité
        $debitStocke  = 0.0;
        $debitEvite   = $debitBrut;
        $ouverturePct = 0;
        $alerteFuite  = 0;

        // Insertion dans l'historique de consommation
        $insert = $pdo->prepare(
            'INSERT INTO consommation (debit_eau, debit_evite, alerte_fuite, debit_brut, ouverture_pct)
             VALUES (:debit, :debit_evite, :alerte, :debit_brut, :ouverture_pct)'
        );
        $insert->execute([
            ':debit'         => $debitStocke,
            ':debit_evite'   => $debitEvite,
            ':alerte'        => $alerteFuite,
            ':debit_brut'    => $debitBrut,
            ':ouverture_pct' => $ouverturePct,
        ]);
        $lastInsertId = (int) $pdo->lastInsertId();

        // RÈGLE DE SÉCURITÉ STRICTE :
        // Tant que la vanne est FERMÉE, etat_alerte reste FERMEE. Détection ignorée.
        if ($etat['etat_alerte'] !== 'FERMEE') {
            $pdo->exec("UPDATE etat_systeme SET etat_alerte = 'FERMEE' WHERE id = 1");
        }

    } else {
        // ── Vanne OUVERTE ou PARTIELLEMENT OUVERTE ──
        $debitStocke  = (float) round($debitBrut * ($pct / 100.0), 3);
        $debitEvite   = (float) round($debitBrut - $debitStocke, 3);
        $ouverturePct = $pct;

        // R2 DÉPASSEMENT : évalue la DEMANDE (debit_brut) vs seuilActif ajusté par coef
        $alerteFuite = ($debitBrut > $seuilActif) ? 1 : 0;

        // Insertion dans l'historique
        $insert = $pdo->prepare(
            'INSERT INTO consommation (debit_eau, debit_evite, alerte_fuite, debit_brut, ouverture_pct)
             VALUES (:debit, :debit_evite, :alerte, :debit_brut, :ouverture_pct)'
        );
        $insert->execute([
            ':debit'         => $debitStocke,
            ':debit_evite'   => $debitEvite,
            ':alerte'        => $alerteFuite,
            ':debit_brut'    => $debitBrut,
            ':ouverture_pct' => $ouverturePct,
        ]);
        $lastInsertId = (int) $pdo->lastInsertId();

        // Vérification de R1 RUPTURE (sur la DEMANDE debit_brut) :
        // SEUIL_RUPTURE (8.0) reste inchangé dans TOUS les régimes et ferme la vanne
        $estRupture = false;
        if ($debitBrut >= SEUIL_RUPTURE) {
            $stmtRupture = $pdo->prepare(
                'SELECT COALESCE(debit_brut, debit_eau) AS val FROM consommation ORDER BY id DESC LIMIT :limit'
            );
            $stmtRupture->bindValue(':limit', N_RUPTURE, PDO::PARAM_INT);
            $stmtRupture->execute();
            $mesuresRupture = $stmtRupture->fetchAll();

            if (count($mesuresRupture) >= N_RUPTURE) {
                $estRupture = true;
                foreach ($mesuresRupture as $mr) {
                    if ((float) $mr['val'] < SEUIL_RUPTURE) {
                        $estRupture = false;
                        break;
                    }
                }
            }
        }

        // Application des règles et machine à états
        if ($estRupture) {
            // R1 RUPTURE : fermeture d'urgence de la vanne (ouverture_pct = 0)
            if ($etat['statut_vanne'] !== 'FERMEE') {
                $pdo->exec("UPDATE etat_systeme SET statut_vanne = 'FERMEE', ouverture_pct = 0 WHERE id = 1");
            }
            $trans = changerEtatAlerte($pdo, 'FERMEE', 'RUPTURE', $debitBrut);
            $notifResults = $trans['notifications'] ?? null;
        } elseif ($alerteFuite) {
            // R2 DÉPASSEMENT : alerte_fuite = 1, la vanne reste ouverte
            if ($etat['etat_alerte'] !== 'FERMEE') {
                $trans = changerEtatAlerte($pdo, 'ALERTE', 'DEPASSEMENT', $debitBrut);
                $notifResults = $trans['notifications'] ?? null;
            }
        } else {
            // Hystérésis de retour à NORMAL : évalue la DEMANDE
            if ($etat['statut_vanne'] === 'OUVERTE' && $etat['etat_alerte'] === 'ALERTE') {
                $stmtRecent = $pdo->prepare(
                    'SELECT COALESCE(debit_brut, debit_eau) AS val, alerte_fuite FROM consommation ORDER BY id DESC LIMIT :limit'
                );
                $stmtRecent->bindValue(':limit', N_SOUTENU, PDO::PARAM_INT);
                $stmtRecent->execute();
                $recentRows = $stmtRecent->fetchAll();

                if (count($recentRows) >= N_SOUTENU) {
                    $toutesNormales = true;
                    foreach ($recentRows as $r) {
                        if ((float) $r['val'] > $seuilActif || (int) $r['alerte_fuite'] === 1) {
                            $toutesNormales = false;
                            break;
                        }
                    }

                    if ($toutesNormales) {
                        $trans = changerEtatAlerte($pdo, 'NORMAL', null, $debitBrut);
                        $notifResults = $trans['notifications'] ?? null;
                    }
                }
            }
        }
    }

    // 4. Relire l'état final à jour pour la réponse JSON
    $stmtFresh = $pdo->query(
        'SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte,
                DATE_FORMAT(alerte_depuis, \'%Y-%m-%d %H:%i:%s\') AS alerte_depuis,
                ouverture_pct
         FROM etat_systeme WHERE id = 1'
    );
    $etatFresh = $stmtFresh->fetch();

    $ouvertureFinale = isset($etatFresh['ouverture_pct']) ? (int) $etatFresh['ouverture_pct'] : $ouverturePct;

    // 5. Réponse JSON
    echo json_encode([
        'success'       => true,
        'id'            => $lastInsertId,
        'debit_eau'     => $debitStocke,
        'debit_evite'   => $debitEvite,
        'debit_brut'    => $debitBrut,
        'ouverture_pct' => $ouvertureFinale,
        'regime'        => $regime,
        'alerte_fuite'  => (bool) $alerteFuite,
        'statut_vanne'  => $etatFresh['statut_vanne'],
        'etat_alerte'   => $etatFresh['etat_alerte'],
        'type_alerte'   => $etatFresh['type_alerte'],
        'alerte_depuis' => $etatFresh['alerte_depuis'],
        'mode_nuit'     => (bool) $etatFresh['mode_nuit'],
        'seuil_utilise' => $seuilActif,
        'notifications' => $notifResults,
    ]);

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
