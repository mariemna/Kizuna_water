<?php
// ============================================================
//  HydroMind — exporter.php
//  Export CSV des données (mesures, alertes, notifications)
//  Optimisé pour Excel FR sous Windows (BOM UTF-8, séparateur ';', décimale ',')
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

// ── 1. Vérification de la session technicien ─────────────────
if (!isWorkerLoggedIn()) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Authentication required. Please sign in to export data.";
    exit;
}

// ── 2. Récupération et validation des paramètres GET ──────────
$type = strtolower(trim($_GET['type'] ?? 'mesures'));
$validTypes = ['mesures', 'alertes', 'notifications'];
if (!in_array($type, $validTypes, true)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Invalid export type. Expected: mesures, alertes, or notifications.";
    exit;
}

$du = trim($_GET['du'] ?? date('Y-m-d'));
$au = trim($_GET['au'] ?? date('Y-m-d'));

$dateRegex = '/^\d{4}-\d{2}-\d{2}$/';
if (!preg_match($dateRegex, $du) || !preg_match($dateRegex, $au)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Invalid date format. Expected YYYY-MM-DD.";
    exit;
}

$d1 = DateTime::createFromFormat('Y-m-d', $du);
$d2 = DateTime::createFromFormat('Y-m-d', $au);

if (!$d1 || !$d2 || $d1->format('Y-m-d') !== $du || $d2->format('Y-m-d') !== $au) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Invalid calendar date.";
    exit;
}

if ($du > $au) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Start date (du) cannot be after end date (au).";
    exit;
}

$diffDays = (int) $d1->diff($d2)->format('%a');
if ($diffDays > 31) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Date range exceeds maximum allowed limit of 31 days.";
    exit;
}

$startDateTime = $du . ' 00:00:00';
$endDateTime   = $au . ' 23:59:59';

// ── 3. Helpers de formatage ───────────────────────────────────

/**
 * Formate un nombre flottant avec une virgule pour Excel FR.
 */
function formatDecimal($val, int $decimals = 2): string
{
    if ($val === null || $val === '') {
        return '0,00';
    }
    return number_format((float) $val, $decimals, ',', '');
}

/**
 * Masque un numéro de téléphone ou identifiant Telegram.
 * Règle : conserve le code pays, les 2 premiers chiffres et les 3 derniers chiffres (+216 20 *** 456).
 */
function maskRecipient(string $dest, string $canal): string
{
    $dest = trim($dest);
    if (empty($dest)) {
        return '—';
    }

    // Cas téléphone international commençant par '+'
    if (str_starts_with($dest, '+')) {
        $digits = preg_replace('/\D/', '', $dest);
        if (strlen($digits) >= 8) {
            $cc = substr($digits, 0, 3);
            $rest = substr($digits, 3);
            $first2 = substr($rest, 0, 2);
            $last3 = substr($rest, -3);
            return "+{$cc} {$first2} *** {$last3}";
        }
    }

    // Cas Telegram Chat ID ou chiffres bruts
    $digitsOnly = preg_replace('/\D/', '', $dest);
    if (strlen($digitsOnly) >= 5) {
        $first2 = substr($digitsOnly, 0, 2);
        $last3 = substr($digitsOnly, -3);
        return "{$first2} *** {$last3}";
    }

    return $dest;
}

/**
 * Libellé humain des états d'alerte.
 */
function formatAlertState(string $etat): string
{
    return match (strtoupper(trim($etat))) {
        'ALERTE' => 'Alert',
        'FERMEE' => 'Closed',
        'NORMAL' => 'Back to normal',
        default  => ucfirst(strtolower($etat)),
    };
}

/**
 * Libellé humain des types d'anomalies.
 */
function formatAlertType(?string $type): string
{
    if (empty($type)) {
        return '—';
    }
    return match (strtoupper(trim($type))) {
        'RUPTURE'     => 'Pipe burst',
        'MNF'         => 'Night leak (Minimum Night Flow)',
        'MICRO_FUITE' => 'Micro-leak (slow seepage)',
        'PIC'         => 'Sudden flow spike',
        'DEPASSEMENT' => 'Flow above threshold',
        'REOUVERTURE' => 'Valve reopened',
        'MANUEL'      => 'Manual command',
        'TEST'        => 'Test alert',
        default       => ucfirst(strtolower($type)),
    };
}

/**
 * Libellé humain des statuts de notification.
 */
function formatNotifStatus(string $statut): string
{
    return match (strtoupper(trim($statut))) {
        'ENVOYE' => 'Sent',
        'SIMULE' => 'Simulated',
        'ERREUR' => 'Failed',
        default  => ucfirst(strtolower($statut)),
    };
}

// ── 4. Entêtes HTTP pour téléchargement CSV ───────────────────
$filename = sprintf('hydromind_%s_%s_%s.csv', $type, $du, $au);

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

$output = fopen('php://output', 'w');

// BOM UTF-8 indispensable pour qu'Excel sous Windows reconnaisse les accents
fprintf($output, "\xEF\xBB\xBF");

// 1ère ligne obligatoire : "HydroMind — Smart Water Management System · <type> · <du> → <au>"
fputcsv($output, ["HydroMind — Smart Water Management System · {$type} · {$du} → {$au}"], ';');

// Ligne vide
fputcsv($output, [], ';');

// ── 5. Extraction et écriture des lignes selon le type ────────
$pdo = getPDO();

if ($type === 'mesures') {
    // Entête des colonnes : ajout de Demand (L/min) et Opening (%)
    fputcsv($output, [
        'Date-Time',
        'Demand (L/min)',
        'Flow (L/min)',
        'Avoided Flow (L/min)',
        'Opening (%)',
        'Valve Status',
        'Alert Flag'
    ], ';');

    $stmt = $pdo->prepare(
        'SELECT DATE_FORMAT(timestamp, \'%Y-%m-%d %H:%i:%s\') AS dt,
                debit_eau,
                debit_evite,
                COALESCE(debit_brut, debit_eau + debit_evite) AS debit_brut,
                ouverture_pct,
                alerte_fuite
         FROM consommation
         WHERE timestamp BETWEEN :start AND :end
         ORDER BY id ASC'
    );
    $stmt->execute([':start' => $startDateTime, ':end' => $endDateTime]);

    while ($row = $stmt->fetch()) {
        $debitEvite = (float) $row['debit_evite'];
        $debitBrut  = (float) $row['debit_brut'];
        $ouvPct     = isset($row['ouverture_pct']) ? (int) $row['ouverture_pct'] : ($debitEvite > 0 ? 0 : 100);

        if ($ouvPct === 0) {
            $valveStatus = 'CLOSED';
        } elseif ($ouvPct < 100) {
            $valveStatus = sprintf('THROTTLED (%d%%)', $ouvPct);
        } else {
            $valveStatus = 'OPEN';
        }

        $alertFlag = ((int) $row['alerte_fuite'] === 1) ? 'Yes' : 'No';

        fputcsv($output, [
            $row['dt'],
            formatDecimal($debitBrut),
            formatDecimal($row['debit_eau']),
            formatDecimal($debitEvite),
            $ouvPct,
            $valveStatus,
            $alertFlag
        ], ';');
    }

} elseif ($type === 'alertes') {
    // Entête des colonnes
    fputcsv($output, [
        'Date-Time',
        'State',
        'Type',
        'Flow (L/min)'
    ], ';');

    // Récupérer le type de l'incident précédent avant le début de la période si le premier état est NORMAL
    $stmtPrev = $pdo->prepare(
        'SELECT type FROM alertes_log WHERE created_at < :start AND etat IN (\'ALERTE\', \'FERMEE\') ORDER BY id DESC LIMIT 1'
    );
    $stmtPrev->execute([':start' => $startDateTime]);
    $lastIncidentType = $stmtPrev->fetchColumn() ?: null;

    $stmt = $pdo->prepare(
        'SELECT DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') AS dt,
                etat,
                type,
                debit
         FROM alertes_log
         WHERE created_at BETWEEN :start AND :end
         ORDER BY id ASC'
    );
    $stmt->execute([':start' => $startDateTime, ':end' => $endDateTime]);

    while ($row = $stmt->fetch()) {
        $etat = strtoupper(trim($row['etat']));
        if ($etat === 'ALERTE' || $etat === 'FERMEE') {
            if (!empty($row['type'])) {
                $lastIncidentType = $row['type'];
            }
            $typeStr = formatAlertType($row['type']);
        } elseif ($etat === 'NORMAL') {
            if (!empty($lastIncidentType)) {
                $typeStr = formatAlertType($lastIncidentType);
            } else {
                $typeStr = '—';
            }
            $lastIncidentType = null;
        } else {
            $typeStr = !empty($row['type']) ? formatAlertType($row['type']) : '—';
        }

        fputcsv($output, [
            $row['dt'],
            formatAlertState($row['etat']),
            $typeStr,
            formatDecimal($row['debit'])
        ], ';');
    }

} elseif ($type === 'notifications') {
    // Entête des colonnes
    fputcsv($output, [
        'Date-Time',
        'Channel',
        'Recipient',
        'Status'
    ], ';');

    $stmt = $pdo->prepare(
        'SELECT DATE_FORMAT(date_envoi, \'%Y-%m-%d %H:%i:%s\') AS dt,
                canal,
                destinataire,
                statut
         FROM notifications_log
         WHERE date_envoi BETWEEN :start AND :end
         ORDER BY id ASC'
    );
    $stmt->execute([':start' => $startDateTime, ':end' => $endDateTime]);

    while ($row = $stmt->fetch()) {
        fputcsv($output, [
            $row['dt'],
            strtoupper($row['canal']),
            maskRecipient($row['destinataire'], $row['canal']),
            formatNotifStatus($row['statut'])
        ], ';');
    }
}

fclose($output);
exit;
