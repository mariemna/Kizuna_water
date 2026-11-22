<?php
// ============================================================
//  HydroMind — rapport.php
//  Rapport d'intervention imprimable (Format A4 portrait, 1-2 pages)
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

// ── 1. Authentification requise ──────────────────────────────
if (!isWorkerLoggedIn()) {
    header('Location: auth.html');
    exit;
}

$worker = getLoggedInWorker();
$techNom = $worker['nom_complet'] ?? 'Maintenance Technician';

// ── 2. Paramètres de période (du / au) ───────────────────────
$du = trim($_GET['du'] ?? date('Y-m-d'));
$au = trim($_GET['au'] ?? date('Y-m-d'));

$dateRegex = '/^\d{4}-\d{2}-\d{2}$/';
if (!preg_match($dateRegex, $du)) $du = date('Y-m-d');
if (!preg_match($dateRegex, $au)) $au = date('Y-m-d');
if ($du > $au) $au = $du;

$d1 = new DateTime($du);
$d2 = new DateTime($au);
if ((int) $d1->diff($d2)->format('%a') > 31) {
    $au = $d1->modify('+31 days')->format('Y-m-d');
}

$startDateTime = $du . ' 00:00:00';
$endDateTime   = $au . ' 23:59:59';
$genereLe      = date('Y-m-d H:i:s');

// ── 3. Helpers ───────────────────────────────────────────────
function maskRecipient(string $dest, string $canal): string
{
    $dest = trim($dest);
    if (empty($dest)) return '—';
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
    $digitsOnly = preg_replace('/\D/', '', $dest);
    if (strlen($digitsOnly) >= 5) {
        $first2 = substr($digitsOnly, 0, 2);
        $last3 = substr($digitsOnly, -3);
        return "{$first2} *** {$last3}";
    }
    return $dest;
}

function formatAlertType(?string $type): string
{
    if (empty($type)) return '—';
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

function formatNotifStatus(string $statut): string
{
    return match (strtoupper(trim($statut))) {
        'ENVOYE', 'SENT'       => 'Sent',
        'SIMULE', 'SIMULATED'  => 'Simulated',
        'ERREUR', 'FAILED', 'ERROR' => 'Failed',
        default                => ucfirst(strtolower($statut)),
    };
}

function formatAlertState(string $etat): string
{
    return match (strtoupper(trim($etat))) {
        'ALERTE' => 'Alert',
        'FERMEE' => 'Closed',
        'NORMAL' => 'Back to normal',
        default  => ucfirst(strtolower($etat)),
    };
}

function formatDurationSec(int $sec): string
{
    if ($sec < 60) return "{$sec}s";
    $m = floor($sec / 60);
    $s = $sec % 60;
    return $s > 0 ? "{$m}m {$s}s" : "{$m}m";
}

// ── 4. Requêtes SQL ──────────────────────────────────────────
$pdo = getPDO();

// État actuel du système
$stmtEtat = $pdo->query('SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte, ouverture_pct, mode_regime FROM etat_systeme WHERE id = 1');
$etatSys = $stmtEtat->fetch() ?: ['statut_vanne' => 'OUVERTE', 'etat_alerte' => 'NORMAL', 'mode_nuit' => 0, 'ouverture_pct' => 100, 'mode_regime' => 'NORMAL'];

// Mesures de débit
$stmtMesures = $pdo->prepare(
    'SELECT id,
            DATE_FORMAT(timestamp, \'%Y-%m-%d %H:%i:%s\') AS dt,
            DATE_FORMAT(timestamp, \'%H:%i:%s\') AS heure,
            UNIX_TIMESTAMP(timestamp) AS ts_sec,
            debit_eau,
            debit_evite,
            COALESCE(debit_brut, debit_eau + debit_evite) AS debit_brut,
            ouverture_pct,
            alerte_fuite
     FROM consommation
     WHERE timestamp BETWEEN :start AND :end
     ORDER BY id ASC'
);
$stmtMesures->execute([':start' => $startDateTime, ':end' => $endDateTime]);
$mesures = $stmtMesures->fetchAll();

$hasData = !empty($mesures);

// Calculs KPIs
$totalMesures = count($mesures);
$eauEconomisee = 0.0;
$consommationTotale = 0.0;
$debits = [];
$prevTs = null;

foreach ($mesures as $m) {
    $currTs = (float) $m['ts_sec'];
    $debitEau = (float) $m['debit_eau'];
    $debitEvite = (float) $m['debit_evite'];
    $debits[] = $debitEau;

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
            $consommationTotale += $debitEau * $deltaMin;
        }
    }
    $prevTs = $currTs;
}

$debitMoyen = count($debits) ? round(array_sum($debits) / count($debits), 2) : 0.0;
$debitMax   = count($debits) ? round(max($debits), 2) : 0.0;

// Alertes log
$stmtAlertes = $pdo->prepare(
    'SELECT id, etat, type, debit,
            DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') AS dt,
            UNIX_TIMESTAMP(created_at) AS ts_sec
     FROM alertes_log
     WHERE created_at BETWEEN :start AND :end
     ORDER BY id ASC'
);
$stmtAlertes->execute([':start' => $startDateTime, ':end' => $endDateTime]);
$alertesLog = $stmtAlertes->fetchAll();

$nbFermeturesAuto = 0;
$typesAlertesCount = [];

foreach ($alertesLog as $al) {
    if ($al['etat'] === 'FERMEE') {
        $nbFermeturesAuto++;
    }
    if ($al['etat'] !== 'NORMAL') {
        $tLabel = formatAlertType($al['type']);
        $typesAlertesCount[$tLabel] = ($typesAlertesCount[$tLabel] ?? 0) + 1;
    }
}

// Appariement des incidents (ALERTE / FERMEE vers NORMAL suivant)
$incidents = [];
$totalLog = count($alertesLog);

for ($i = 0; $i < $totalLog; $i++) {
    $item = $alertesLog[$i];
    if ($item['etat'] === 'ALERTE' || $item['etat'] === 'FERMEE') {
        $startTime = $item['dt'];
        $startTs   = (int) $item['ts_sec'];
        $typeLabel = formatAlertType($item['type']);
        $action    = ($item['etat'] === 'FERMEE') ? 'Automatic closure' : 'Alert';
        $flowVal   = number_format((float)$item['debit'], 2, ',', '') . ' L/min';

        // Recherche du prochain NORMAL
        $endTime  = '—';
        $duration = 'Ongoing';
        for ($j = $i + 1; $j < $totalLog; $j++) {
            if ($alertesLog[$j]['etat'] === 'NORMAL') {
                $endTime  = $alertesLog[$j]['dt'];
                $endTs    = (int) $alertesLog[$j]['ts_sec'];
                $diffSec  = max(0, $endTs - $startTs);
                $duration = formatDurationSec($diffSec);
                break;
            }
        }

        $incidents[] = [
            'start'    => $startTime,
            'type'     => $typeLabel,
            'action'   => $action,
            'flow'     => $flowVal,
            'end'      => $endTime,
            'duration' => $duration,
        ];
    }
}

// Notifications envoyées
$stmtNotifs = $pdo->prepare(
    'SELECT DATE_FORMAT(date_envoi, \'%Y-%m-%d %H:%i:%s\') AS dt,
            canal, destinataire, statut
     FROM notifications_log
     WHERE date_envoi BETWEEN :start AND :end
     ORDER BY id ASC'
);
$stmtNotifs->execute([':start' => $startDateTime, ':end' => $endDateTime]);
$notifications = $stmtNotifs->fetchAll();

// Données échantillonnées pour Chart.js (max 60 points)
$chartLabels = [];
$chartDataFlow = [];
$chartDataAvoided = [];
$step = ($totalMesures > 60) ? ceil($totalMesures / 60) : 1;

for ($k = 0; $k < $totalMesures; $k += $step) {
    $m = $mesures[$k];
    $chartLabels[] = $m['heure'];
    $chartDataFlow[] = (float) $m['debit_eau'];
    $chartDataAvoided[] = (float) $m['debit_evite'];
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    (function(){try{var s=localStorage.getItem('kizuna_theme');var t=s||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intervention Report — HydroMind</title>
  <link rel="icon" type="image/png" href="assets/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/themes.css?v=20261121">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="assets/i18n.js?v=20261121jp"></script>

  <style>
    /* ── Mise en page globale & Écran ──────────────────────────── */
    body {
      font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg-dashboard);
      color: var(--text-primary);
      margin: 0;
      padding: 24px 20px 40px;
      line-height: 1.5;
    }

    .report-wrapper {
      max-width: 960px;
      margin: 0 auto;
    }

    /* Barre d'actions écran */
    .screen-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 15px;
      border-radius: 6px;
      background: var(--surface-card);
      border: 1px solid var(--border-default);
      color: var(--text-primary);
      text-decoration: none;
      font-size: 11px;
      font-weight: 700;
      transition: all 0.15s ease;
    }
    .btn-back:hover {
      background: var(--surface-subtle-hover);
      border-color: var(--brand-blue);
      color: var(--brand-blue);
    }

    .btn-print {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 6px;
      background: var(--brand-blue);
      color: #ffffff;
      border: none;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(8, 126, 186, 0.25);
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .btn-print:hover {
      background: var(--brand-blue-hover);
      transform: translateY(-1px);
    }

    /* Feuille de rapport A4 */
    .report-sheet {
      background: var(--surface-card);
      border: 1px solid var(--border-default);
      border-radius: 10px;
      padding: 32px 36px;
      box-shadow: var(--shadow-md);
    }

    /* En-tête du rapport */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid var(--border-default);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .report-logo-box img {
      width: 120px;
      height: auto;
      max-height: 55px;
      object-fit: contain;
      display: block;
    }

    .report-title-box {
      text-align: right;
    }

    .report-title-box h1 {
      font: 800 20px Manrope, sans-serif;
      color: var(--text-heading);
      margin: 0 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .report-meta-tag {
      font-size: 10px;
      color: var(--text-muted);
      margin: 2px 0;
    }
    .report-meta-tag b {
      color: var(--text-secondary);
    }

    /* Grille d'informations site */
    .site-info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: var(--surface-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 22px;
    }

    .site-info-cell small {
      display: block;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 700;
      margin-bottom: 2px;
    }
    .site-info-cell span {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-heading);
      display: block;
    }

    /* Cartes KPI résumé */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 22px;
    }

    .kpi-card {
      background: var(--surface-card-subtle);
      border: 1px solid var(--border-default);
      border-radius: 8px;
      padding: 14px;
    }

    .kpi-card small {
      display: block;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .kpi-card strong {
      font: 800 20px Manrope, sans-serif;
      color: var(--brand-blue);
      display: block;
      line-height: 1.1;
    }
    .kpi-card strong span {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-left: 3px;
    }

    .kpi-card p {
      font-size: 9px;
      color: var(--text-secondary);
      margin: 5px 0 0;
    }

    /* Sections du rapport */
    .report-section {
      margin-bottom: 22px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-title {
      font: 700 12px Manrope, sans-serif;
      color: var(--text-heading);
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border-default);
      padding-bottom: 6px;
    }

    /* Graphique Chart.js */
    .chart-container {
      height: 190px;
      position: relative;
      background: var(--surface-card-subtle);
      border: 1px solid var(--border-default);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 22px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Tableaux de données */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 6px;
    }

    .report-table th {
      background: var(--surface-subtle);
      color: var(--text-secondary);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 8px;
      padding: 7px 10px;
      text-align: left;
      border-bottom: 1px solid var(--border-default);
    }

    .report-table td {
      padding: 7px 10px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    .report-table tr:last-child td {
      border-bottom: none;
    }

    .badge-cell {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }
    .badge-alert {
      background: var(--state-alerte-emblem-bg);
      color: var(--state-alerte-accent);
    }
    .badge-closed {
      background: var(--state-fermee-emblem-bg);
      color: var(--state-fermee-accent);
    }
    .badge-normal {
      background: var(--state-normal-emblem-bg);
      color: var(--state-normal-accent);
    }

    /* Cadre règles de détection R1-R5 */
    .rules-table {
      font-size: 9px;
      border: 1px solid var(--border-default);
      border-radius: 6px;
      overflow: hidden;
    }

    /* Boîte d'intervention terrain */
    .field-intervention {
      border: 1px solid var(--border-default);
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--surface-card-subtle);
      break-inside: avoid;
      page-break-inside: avoid;
      margin-top: 20px;
    }

    .field-notes-lines {
      margin: 10px 0 16px;
    }
    .ruled-line {
      height: 24px;
      border-bottom: 1px dashed var(--border-default);
    }

    .field-signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--border-default);
    }

    .sig-box small {
      display: block;
      font-size: 8px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .sig-box span {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-heading);
    }
    .sig-area {
      height: 40px;
      border: 1px dashed var(--border-interactive);
      border-radius: 4px;
      background: var(--surface-card);
      margin-top: 4px;
    }

    /* Pied de page du rapport */
    .report-footer {
      border-top: 1px solid var(--border-default);
      padding-top: 12px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: var(--text-muted);
    }

    /* ── STYLES D'IMPRESSION STRICTS (A4) ──────────────────────── */
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
      }

      body {
        background: #ffffff !important;
        color: #111827 !important;
        padding: 0 !important;
        font-size: 9.5px !important;
      }

      .screen-actions,
      .theme-switcher,
      .language-switcher,
      .btn-print,
      .btn-back {
        display: none !important;
      }

      .report-sheet {
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
      }

      .site-info-grid,
      .kpi-card,
      .chart-container,
      .field-intervention,
      .report-table th,
      .rules-table {
        background: #f9fafb !important;
        border-color: #e5e7eb !important;
        color: #111827 !important;
      }

      .report-table td {
        border-bottom-color: #f3f4f6 !important;
        color: #111827 !important;
      }

      .report-title-box h1,
      .section-title,
      .site-info-cell span,
      .kpi-card strong,
      .sig-box span {
        color: #111827 !important;
      }

      .chart-container {
        height: 160px !important;
      }

      .report-section,
      .kpi-row,
      .chart-container,
      .field-intervention,
      tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>

<div class="report-wrapper">

  <!-- Actions écran : Imprimer & Retour -->
  <div class="screen-actions">
    <a class="btn-back" href="dashboard.html">
      ← Back to Dashboard
    </a>
    <button class="btn-print" type="button" onclick="window.print()">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <article class="report-sheet">

    <!-- ── En-tête officiel ──────────────────────────────────── -->
    <header class="report-header">
      <div class="report-logo-box">
        <img src="assets/img/hydromind-logo.png" alt="HydroMind">
        <div style="font-size:8px; font-weight:700; color:var(--text-muted); letter-spacing:1px; margin-top:6px;">
          SMART WATER MANAGEMENT SYSTEM
        </div>
      </div>
      <div class="report-title-box">
        <h1>Intervention Report</h1>
        <div class="report-meta-tag">Period: <b><?= htmlspecialchars($du) ?></b> → <b><?= htmlspecialchars($au) ?></b></div>
        <div class="report-meta-tag">Generated: <b><?= htmlspecialchars($genereLe) ?></b> (UTC+1)</div>
        <div class="report-meta-tag">Inspector: <b><?= htmlspecialchars($techNom) ?></b></div>
      </div>
    </header>

    <!-- ── Coordonnées & Site ─────────────────────────────────── -->
    <div class="site-info-grid">
      <div class="site-info-cell">
        <small>Sector Name</small>
        <span><?= htmlspecialchars(DEFAULT_SECTOR_NAME) ?></span>
      </div>
      <div class="site-info-cell">
        <small>Physical Address</small>
        <span><?= htmlspecialchars(DEFAULT_SECTOR_ADDR) ?></span>
      </div>
      <div class="site-info-cell">
        <small>GPS Coordinates</small>
        <span><?= number_format(DEFAULT_SECTOR_LAT, 4) ?>° N · <?= number_format(DEFAULT_SECTOR_LNG, 4) ?>° E</span>
      </div>
      <div class="site-info-cell">
        <small>System &amp; Valve State</small>
        <?php
          $ouvPct = isset($etatSys['ouverture_pct']) ? (int) $etatSys['ouverture_pct'] : 100;
          $statutVanneFormatted = ($etatSys['statut_vanne'] === 'FERMEE' || $ouvPct === 0)
              ? 'CLOSED'
              : ($ouvPct < 100 ? "THROTTLED ({$ouvPct}%)" : 'OPEN');
          $etatAlerteFormatted = match(strtoupper(trim($etatSys['etat_alerte']))) {
              'FERMEE' => 'Closed',
              'ALERTE' => 'Alert',
              'NORMAL' => 'Normal',
              default  => ucfirst(strtolower($etatSys['etat_alerte'])),
          };
        ?>
        <span>Valve <?= htmlspecialchars($statutVanneFormatted) ?> · State: <?= htmlspecialchars($etatAlerteFormatted) ?></span>
      </div>
    </div>

    <!-- ── État vide si aucune mesure ────────────────────────── -->
    <?php if (!$hasData): ?>
      <div style="background:var(--surface-subtle); border:1px dashed var(--border-default); border-radius:8px; padding:30px; text-align:center; color:var(--text-muted); margin:20px 0;">
        <h3 style="margin:0 0 6px; color:var(--text-heading); font-size:14px;">No data for this period</h3>
        <p style="margin:0; font-size:11px;" id="noDataPeriodMsg">No consumption or alert measurements were recorded between <?= htmlspecialchars($du) ?> and <?= htmlspecialchars($au) ?>.</p>
      </div>
    <?php else: ?>

      <!-- ── KPIs Période ──────────────────────────────────────── -->
      <div class="kpi-row">
        <div class="kpi-card">
          <small>Total Consumption</small>
          <strong><?= number_format($consommationTotale, 2, ',', ' ') ?><span>L</span></strong>
          <p>Over period (Δt rule)</p>
        </div>
        <div class="kpi-card">
          <small>Water Saved</small>
          <strong style="color:var(--color-success);"><?= number_format($eauEconomisee, 2, ',', ' ') ?><span>L</span></strong>
          <p>Preserved via shutoff</p>
        </div>
        <div class="kpi-card">
          <small>Flow Dynamics</small>
          <strong><?= number_format($debitMoyen, 1, ',', '') ?><span>avg</span> / <?= number_format($debitMax, 1, ',', '') ?><span>max</span></strong>
          <p>L/min flow range</p>
        </div>
        <div class="kpi-card">
          <small>Automatic Closures</small>
          <strong style="color:var(--state-fermee-accent);"><?= $nbFermeturesAuto ?><span>events</span></strong>
          <p><?= count($incidents) ?> <span data-i18n="alert incidents total">alert incidents total</span></p>
        </div>
      </div>

      <!-- ── Évolution du débit (Graphique) ───────────────────── -->
      <section class="report-section">
        <h2 class="section-title">📊 Flow Monitoring Over Period</h2>
        <div class="chart-container">
          <canvas id="reportChart"></canvas>
        </div>
      </section>

      <!-- ── Historique des Incidents ──────────────────────────── -->
      <section class="report-section">
        <h2 class="section-title">🚨 Detected Incidents &amp; Actuation Log</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th>Start Time</th>
              <th>Anomaly Type</th>
              <th>Action Taken</th>
              <th>Flow</th>
              <th>End Time</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($incidents)): ?>
              <tr>
                <td colspan="6" style="text-align:center; color:var(--text-muted); padding:14px;">
                  ✓ No leak or anomaly incidents recorded during this period.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($incidents as $inc): ?>
                <tr>
                  <td><b><?= htmlspecialchars($inc['start']) ?></b></td>
                  <td><?= htmlspecialchars($inc['type']) ?></td>
                  <td>
                    <?php if ($inc['action'] === 'Automatic closure'): ?>
                      <span class="badge-cell badge-closed">🔒 Automatic closure</span>
                    <?php else: ?>
                      <span class="badge-cell badge-alert">⚠️ Alert</span>
                    <?php endif; ?>
                  </td>
                  <td><b><?= htmlspecialchars($inc['flow']) ?></b></td>
                  <td><?= htmlspecialchars($inc['end']) ?></td>
                  <td><b><?= htmlspecialchars($inc['duration']) ?></b></td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </section>

      <!-- ── Notifications d'Urgence ──────────────────────────── -->
      <section class="report-section">
        <h2 class="section-title">📱 Emergency Notifications Sent</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date-Time</th>
              <th>Channel</th>
              <th>Recipient (Masked)</th>
              <th>Delivery Status</th>
            </tr>
          </thead>
          <tbody>
            <?php if (empty($notifications)): ?>
              <tr>
                <td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">
                  No emergency notifications were transmitted during this period.
                </td>
              </tr>
            <?php else: ?>
              <?php foreach ($notifications as $n): ?>
                <tr>
                  <td><?= htmlspecialchars($n['dt']) ?></td>
                  <td><b><?= htmlspecialchars(strtoupper($n['canal'])) ?></b></td>
                  <td><code><?= htmlspecialchars(maskRecipient($n['destinataire'], $n['canal'])) ?></code></td>
                  <td>
                    <?php 
                      $notifFormatted = formatNotifStatus($n['statut']);
                      if ($notifFormatted === 'Failed'): 
                    ?>
                      <span class="badge-cell badge-alert">● <?= htmlspecialchars($notifFormatted) ?></span>
                    <?php else: ?>
                      <span class="badge-cell badge-normal">✓ <?= htmlspecialchars($notifFormatted) ?></span>
                    <?php endif; ?>
                  </td>
                </tr>
              <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </section>

    <?php endif; ?>

    <!-- ── Règles de détection R1-R5 ─────────────────────────── -->
    <section class="report-section">
      <h2 class="section-title">⚙️ Active Detection Rules (Config Calibration)</h2>
      <table class="report-table rules-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Name</th>
            <th>Thresholds &amp; Parameters</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>R1</b></td>
            <td>Pipe Burst (Rupture)</td>
            <td>Flow &ge; <?= number_format(SEUIL_RUPTURE, 1) ?> L/min for <?= N_RUPTURE ?> consecutive readings</td>
            <td><span class="badge-cell badge-closed">🔒 Automatic valve shutoff</span></td>
          </tr>
          <tr>
            <td><b>R2</b></td>
            <td>Daytime Threshold</td>
            <td>Flow &gt; <?= number_format(SEUIL_JOUR, 1) ?> L/min</td>
            <td><span class="badge-cell badge-alert">⚠️ Alert triggered</span></td>
          </tr>
          <tr>
            <td><b>R3</b></td>
            <td>Minimum Night Flow (MNF)</td>
            <td>Flow &gt; <?= number_format(SEUIL_NUIT * MICRO_RATIO, 2) ?> L/min sustained in night window</td>
            <td><span class="badge-cell badge-closed">🔒 Automatic valve shutoff</span></td>
          </tr>
          <tr>
            <td><b>R4</b></td>
            <td>Sudden Flow Spike (Pic)</td>
            <td>Z-score &gt; <?= number_format(ZSCORE_SEUIL, 1) ?> (std &ge; <?= number_format(STD_MIN, 1) ?>, jump &ge; <?= number_format(SAUT_MIN, 1) ?> L/min)</td>
            <td><span class="badge-cell badge-alert">⚠️ Alert triggered</span></td>
          </tr>
          <tr>
            <td><b>R5</b></td>
            <td>Micro-Leak (Slow Seepage)</td>
            <td>Flow in ]<?= number_format(SEUIL_JOUR * MICRO_RATIO, 1) ?>, <?= number_format(SEUIL_JOUR, 1) ?>[ L/min sustained for <?= N_SOUTENU ?> readings</td>
            <td><span class="badge-cell badge-alert">⚠️ Alert (Valve open under watch)</span></td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- ── Cadre d'intervention terrain ──────────────────────── -->
    <section class="field-intervention">
      <h2 class="section-title" style="margin-bottom:6px;">✍️ Field Intervention Notes &amp; Sign-off</h2>
      <div class="field-notes-lines">
        <div class="ruled-line"></div>
        <div class="ruled-line"></div>
        <div class="ruled-line"></div>
      </div>
      <div class="field-signature-grid">
        <div class="sig-box">
          <small>Intervention Date</small>
          <span><?= date('Y-m-d') ?></span>
        </div>
        <div class="sig-box">
          <small>Technician Name</small>
          <span><?= htmlspecialchars($techNom) ?></span>
        </div>
        <div class="sig-box">
          <small>Signature &amp; Stamp</small>
          <div class="sig-area"></div>
        </div>
      </div>
    </section>

    <!-- ── Pied de page ──────────────────────────────────────── -->
    <footer class="report-footer">
      <span>HydroMind — Smart Water Management System · Real-time Monitoring</span>
      <span>Official Intervention Document · Sector A Validation</span>
    </footer>

  </article>

</div>

<?php if ($hasData): ?>
<script>
  document.addEventListener('DOMContentLoaded', function () {
    const ctx = document.getElementById('reportChart');
    if (!ctx) return;

    const labels = <?= json_encode($chartLabels) ?>;
    const dataFlow = <?= json_encode($chartDataFlow) ?>;
    const thresholdVal = <?= json_encode(SEUIL_JOUR) ?>;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: (window.KizunaI18n ? window.KizunaI18n.t('Measured Flow (L/min)') : 'Measured Flow (L/min)'),
            data: dataFlow,
            borderColor: '#087eBA',
            backgroundColor: 'rgba(8, 126, 186, 0.08)',
            fill: true,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: labels.length > 30 ? 1.5 : 3,
          },
          {
            label: (window.KizunaI18n ? window.KizunaI18n.t('Alert Threshold ({threshold} L/min)', { threshold: '<?= number_format(SEUIL_JOUR, 1) ?>' }) : 'Alert Threshold (<?= number_format(SEUIL_JOUR, 1) ?> L/min)'),
            data: Array(labels.length).fill(thresholdVal),
            borderColor: '#f2a34a',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { boxWidth: 12, font: { size: 9 } }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 8 }, maxTicksLimit: 12 }
          },
          y: {
            beginAtZero: true,
            ticks: { font: { size: 8 } }
          }
        }
      }
    });
  });
</script>
<?php endif; ?>

<div class="theme-switcher" role="radiogroup" aria-label="Theme switcher">
  <button type="button" data-theme-value="light" aria-label="Light theme" title="Light theme">☀️ <span>Light</span></button>
  <button type="button" data-theme-value="dark" aria-label="Dark theme" title="Dark theme">🌙 <span>Dark</span></button>
  <button type="button" data-theme-value="comfort" aria-label="Eye comfort theme" title="Eye comfort theme">👁️ <span>Comfort</span></button>
</div>
<script src="assets/theme.js?v=20261121"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const emptyMsg = document.getElementById('noDataPeriodMsg');
  if (emptyMsg && window.KizunaI18n && window.KizunaI18n.getLanguage() === 'jp') {
    emptyMsg.textContent = window.KizunaI18n.t('No consumption or alert measurements were recorded between {du} and {au}.', {
      du: <?= json_encode($du) ?>,
      au: <?= json_encode($au) ?>
    });
  }
});
</script>
</body>
</html>
