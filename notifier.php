<?php
// ============================================================
//  HydroMind — notifier.php
//  Module partagé de notification d'alerte (SMS Twilio vs Telegram Bot)
// ============================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

/**
 * Envoie un SMS via l'API Twilio ou enregistre une simulation propre.
 *
 * RÈGLE STRICTE : AUCUN LIEN URL DANS LE MESSAGE SMS.
 * Doit contenir l'adresse physique complète et les coordonnées GPS textuelles.
 *
 * @param string $telephone Numéro du destinataire (ex: +21620123456)
 * @param string $messageTexte Message brut sans URL
 * @return array ['success' => bool, 'mode' => 'TWILIO'|'SIMULE', 'detail' => string]
 */
function envoyerSmsTwilio(string $telephone, string $messageTexte): array
{
    $sid   = defined('TWILIO_SID') ? trim(TWILIO_SID) : '';
    $token = defined('TWILIO_TOKEN') ? trim(TWILIO_TOKEN) : '';
    $from  = defined('TWILIO_FROM') ? trim(TWILIO_FROM) : '';

    // Si les identifiants Twilio ne sont pas configurés -> Mode simulation sécurisé
    if (empty($sid) || empty($token) || empty($from) || str_starts_with($sid, 'AC_demo')) {
        return [
            'success' => true,
            'mode'    => 'SIMULE',
            'detail'  => "SMS simulé vers {$telephone} (Twilio non configuré)",
            'message' => $messageTexte
        ];
    }

    $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";
    $postData = http_build_query([
        'To'   => $telephone,
        'From' => $from,
        'Body' => $messageTexte,
    ]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postData,
        CURLOPT_USERPWD        => "{$sid}:{$token}",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr || $httpCode >= 400) {
        return [
            'success' => false,
            'mode'    => 'TWILIO',
            'detail'  => "Erreur envoi SMS Twilio (HTTP {$httpCode}) : {$curlErr}",
            'message' => $messageTexte
        ];
    }

    return [
        'success' => true,
        'mode'    => 'TWILIO',
        'detail'  => "SMS réel envoyé avec succès vers {$telephone}",
        'message' => $messageTexte
    ];
}

/**
 * Envoie une notification via l'API Telegram Bot ou enregistre une simulation propre.
 *
 * RÈGLE : Contient les détails ET un lien Google Maps cliquable pointant sur la fuite.
 *
 * @param string $chatId Identifiant du chat Telegram
 * @param string $messageHtml Message formaté en HTML avec lien Google Maps
 * @return array ['success' => bool, 'mode' => 'TELEGRAM'|'SIMULE', 'detail' => string]
 */
function envoyerTelegram(string $chatId, string $messageHtml): array
{
    $botToken = defined('TELEGRAM_BOT_TOKEN') ? trim(TELEGRAM_BOT_TOKEN) : '';

    // Si le token n'est pas configuré -> Mode simulation sécurisé
    if (empty($botToken) || str_contains($botToken, 'YOUR_TELEGRAM_BOT_TOKEN') || str_starts_with($botToken, '123456789:ABC')) {
        return [
            'success' => true,
            'mode'    => 'SIMULE',
            'detail'  => "Telegram simulé vers ChatID {$chatId} (Bot token non configuré)",
            'message' => $messageHtml
        ];
    }

    $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
    $postData = [
        'chat_id'                  => $chatId,
        'text'                     => $messageHtml,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => false,
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($postData),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr || $httpCode >= 400) {
        return [
            'success' => false,
            'mode'    => 'TELEGRAM',
            'detail'  => "Erreur API Telegram (HTTP {$httpCode}) : {$curlErr}",
            'message' => $messageHtml
        ];
    }

    return [
        'success' => true,
        'mode'    => 'TELEGRAM',
        'detail'  => "Message Telegram envoyé au ChatID {$chatId}",
        'message' => $messageHtml
    ];
}

/**
 * Notifie l'ensemble des techniciens concernés selon leurs canaux choisis (SMS vs Telegram).
 *
 * @param array $alerteData [
 *     'debit_eau'     => float,
 *     'statut_vanne'  => string,
 *     'secteur'       => string,
 *     'adresse'       => string,
 *     'lat'           => float,
 *     'lng'           => float,
 *     'timestamp'     => string,
 *     'etat_alerte'   => string ('NORMAL', 'ALERTE', 'FERMEE'),
 *     'type_anomalie' => ?string,
 * ]
 * @param PDO|null $pdo
 * @return array Bilan complet des notifications
 */
function notifierTechniciens(array $alerteData, ?PDO $pdo = null): array
{
    $pdo = $pdo ?? getPDO();

    $debit        = number_format((float) ($alerteData['debit_eau'] ?? 0), 1);
    $rawVanne     = strtoupper($alerteData['statut_vanne'] ?? 'FERMEE');
    $vanne        = ($rawVanne === 'OUVERTE' || $rawVanne === 'OPEN') ? 'OPEN' : 'CLOSED';
    $secteur      = $alerteData['secteur'] ?? DEFAULT_SECTOR_NAME;
    $adresse      = $alerteData['adresse'] ?? DEFAULT_SECTOR_ADDR;
    $lat          = (float) ($alerteData['lat'] ?? DEFAULT_SECTOR_LAT);
    $lng          = (float) ($alerteData['lng'] ?? DEFAULT_SECTOR_LNG);
    $timeStr      = $alerteData['timestamp'] ?? date('Y-m-d H:i:s');
    $etatAlerte   = strtoupper($alerteData['etat_alerte'] ?? 'FERMEE');
    $typeAnomalie = $alerteData['type_anomalie'] ?? null;
    $typeUpper    = !empty($typeAnomalie) ? strtoupper(trim($typeAnomalie)) : '';

    $seuilTag  = '';
    $ruleExpl  = '';
    if ($typeUpper === 'DEPASSEMENT' || $typeUpper === 'RUPTURE') {
        $seuilTag = ' (threshold exceeded)';
    } elseif ($typeUpper === 'MNF') {
        $ruleExpl = 'Abnormal nocturnal baseflow detected during Minimum Night Flow window.';
    } elseif ($typeUpper === 'MICRO_FUITE') {
        $ruleExpl = 'Persistent low-flow seepage detected over continuous window.';
    } elseif ($typeUpper === 'PIC') {
        $ruleExpl = 'Sudden abnormal flow spike detected compared to baseline.';
    }

    $googleMapsUrl = "https://www.google.com/maps?q={$lat},{$lng}";

    // ── Adaptation des titres et contenus selon etat_alerte ───────
    if ($etatAlerte === 'NORMAL') {
        // Message court de réouverture
        $smsBody = "[HYDROMIND] ✅ Valve reopened – back to normal\n"
                 . "Sector: {$secteur}\n"
                 . "Current flow: {$debit} L/min\n"
                 . "Valve status: {$vanne}";

        $telegramBody = "<b>HydroMind</b>\n"
                      . "✅ <b>Valve reopened – back to normal</b>\n\n"
                      . "📍 <b>Sector:</b> {$secteur}\n"
                      . "💧 <b>Current flow:</b> <b>{$debit} L/min</b>\n"
                      . "🔓 <b>Valve status:</b> <b>{$vanne}</b>\n"
                      . "🕒 <b>Timestamp:</b> {$timeStr}";
    } elseif ($etatAlerte === 'ALERTE') {
        // Anomalie détectée – vanne ouverte sous surveillance
        $typeLine = !empty($typeAnomalie) ? "Anomaly type: {$typeAnomalie}\n" : "";
        $ruleLine = !empty($ruleExpl) ? "Rule: {$ruleExpl}\n" : "";
        $smsBody  = "[HYDROMIND] ⚠️ Anomaly detected – valve open, monitoring\n"
                  . "Sector: {$secteur}\n"
                  . "Address: {$adresse} (GPS: {$lat}, {$lng})\n"
                  . "Measured flow: {$debit} L/min{$seuilTag}\n"
                  . $typeLine
                  . $ruleLine
                  . "Valve status: {$vanne}\n"
                  . "Inspection recommended.";

        $typeHtml = !empty($typeAnomalie) ? "⚠️ <b>Anomaly type:</b> {$typeAnomalie}\n" : "";
        $ruleHtml = !empty($ruleExpl) ? "📋 <b>Rule:</b> {$ruleExpl}\n" : "";
        $telegramBody = "<b>HydroMind</b>\n"
                      . "⚠️ <b>Anomaly detected – valve open, monitoring</b>\n\n"
                      . "📍 <b>Sector:</b> {$secteur}\n"
                      . "🏢 <b>Address:</b> {$adresse}\n"
                      . "💧 <b>Measured flow:</b> <b>{$debit} L/min</b>{$seuilTag}\n"
                      . $typeHtml
                      . $ruleHtml
                      . "🔓 <b>Valve status:</b> <b>{$vanne}</b>\n"
                      . "🕒 <b>Timestamp:</b> {$timeStr}\n\n"
                      . "ℹ️ <i>Inspection recommended.</i>\n\n"
                      . "🗺️ <b>Direct GPS location:</b>\n"
                      . "<a href=\"{$googleMapsUrl}\">Open in Google Maps ↗</a>\n"
                      . "<code>{$googleMapsUrl}</code>";
    } else {
        // FERMEE – Fuite confirmée – vanne fermée automatiquement
        $typeLine = !empty($typeAnomalie) ? "Anomaly type: {$typeAnomalie}\n" : "";
        $ruleLine = !empty($ruleExpl) ? "Rule: {$ruleExpl}\n" : "";
        $smsBody  = "[HYDROMIND] 🚨 LEAK CONFIRMED – valve closed automatically\n"
                  . "Sector: {$secteur}\n"
                  . "Address: {$adresse} (GPS: {$lat}, {$lng})\n"
                  . "Measured flow: {$debit} L/min{$seuilTag}\n"
                  . $typeLine
                  . $ruleLine
                  . "Valve status: {$vanne} (safety activated)\n"
                  . "Immediate intervention required on site.";

        $typeHtml = !empty($typeAnomalie) ? "⚠️ <b>Anomaly type:</b> {$typeAnomalie}\n" : "";
        $ruleHtml = !empty($ruleExpl) ? "📋 <b>Rule:</b> {$ruleExpl}\n" : "";
        $telegramBody = "<b>HydroMind</b>\n"
                      . "🚨 <b>LEAK CONFIRMED – valve closed automatically</b>\n\n"
                      . "📍 <b>Sector:</b> {$secteur}\n"
                      . "🏢 <b>Address:</b> {$adresse}\n"
                      . "💧 <b>Measured flow:</b> <b>{$debit} L/min</b>{$seuilTag}\n"
                      . $typeHtml
                      . $ruleHtml
                      . "🔒 <b>Valve status:</b> <b>{$vanne}</b> (safety activated)\n"
                      . "🕒 <b>Timestamp:</b> {$timeStr}\n\n"
                      . "🚨 <b>Immediate intervention required on site.</b>\n\n"
                      . "🗺️ <b>Direct GPS location:</b>\n"
                      . "<a href=\"{$googleMapsUrl}\">Open in Google Maps ↗</a>\n"
                      . "<code>{$googleMapsUrl}</code>";
    }

    // Récupérer les techniciens abonnés
    $stmt = $pdo->query(
        'SELECT id, nom_complet, telephone, telegram_chat_id, notify_sms, notify_telegram, secteur_assigne
         FROM workers
         WHERE (notify_sms = 1 AND telephone IS NOT NULL AND telephone != \'\')
            OR (notify_telegram = 1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id != \'\')'
    );
    $workers = $stmt->fetchAll();

    $logInsert = $pdo->prepare(
        'INSERT INTO notifications_log (worker_id, canal, destinataire, message, statut)
         VALUES (:wid, :canal, :dest, :msg, :statut)'
    );

    $results = [
        'sms_envoyes'      => 0,
        'telegram_envoyes' => 0,
        'destinataires'    => [],
        'journal'          => [],
    ];

    foreach ($workers as $w) {
        $wid = (int) $w['id'];

        // Envoi SMS
        if (!empty($w['notify_sms']) && !empty($w['telephone'])) {
            $smsRes = envoyerSmsTwilio($w['telephone'], $smsBody);
            $statut = $smsRes['success'] ? ($smsRes['mode'] === 'TWILIO' ? 'ENVOYE' : 'SIMULE') : 'ERREUR';

            try {
                $logInsert->execute([
                    ':wid'    => $wid,
                    ':canal'  => 'SMS',
                    ':dest'   => $w['telephone'],
                    ':msg'    => $smsBody,
                    ':statut' => $statut,
                ]);
            } catch (Exception $e) {}

            $results['sms_envoyes']++;
            $results['journal'][] = [
                'canal'        => 'SMS',
                'destinataire' => $w['telephone'],
                'worker'       => $w['nom_complet'],
                'statut'       => $statut,
                'detail'       => $smsRes['detail'],
            ];
        }

        // Envoi Telegram
        if (!empty($w['notify_telegram']) && !empty($w['telegram_chat_id'])) {
            $tgRes = envoyerTelegram($w['telegram_chat_id'], $telegramBody);
            $statut = $tgRes['success'] ? ($tgRes['mode'] === 'TELEGRAM' ? 'ENVOYE' : 'SIMULE') : 'ERREUR';

            try {
                $logInsert->execute([
                    ':wid'    => $wid,
                    ':canal'  => 'TELEGRAM',
                    ':dest'   => $w['telegram_chat_id'],
                    ':msg'    => $telegramBody,
                    ':statut' => $statut,
                ]);
            } catch (Exception $e) {}

            $results['telegram_envoyes']++;
            $results['journal'][] = [
                'canal'        => 'TELEGRAM',
                'destinataire' => $w['telegram_chat_id'],
                'worker'       => $w['nom_complet'],
                'statut'       => $statut,
                'detail'       => $tgRes['detail'],
                'maps_url'     => $googleMapsUrl,
            ];
        }

        $results['destinataires'][] = $w['nom_complet'];
    }

    return $results;
}

/**
 * Envoie une notification préventive Telegram lors d'une prédiction de tendance R6.
 *
 * RÈGLES STRICTES :
 * - Aucun SMS (uniquement Telegram).
 * - Envoi SEULEMENT si prediction_active = 0 ou si PRED_COOLDOWN_MIN (30 min) s'est écoulé depuis prediction_depuis.
 * - Met à jour etat_systeme : prediction_active=1, prediction_depuis=NOW(), prediction_eta_min, prediction_pente.
 * - Ne touche JAMAIS à statut_vanne ni à etat_alerte.
 * - Enregistre dans notifications_log avec canal 'TELEGRAM'.
 *
 * @param PDO $pdo
 * @param array $p [
 *     'debit'   => float,
 *     'pente'   => float (L/min par minute),
 *     'r2'      => float,
 *     'eta_min' => float (minutes),
 *     'cible'   => float (seuil cible),
 *     'mode'    => string ('day'|'night'),
 *     'secteur' => ?string,
 *     'adresse' => ?string,
 *     'lat'     => ?float,
 *     'lng'     => ?float,
 * ]
 * @return array
 */
function notifierPrediction(PDO $pdo, array $p): array
{
    $debit   = (float) ($p['debit'] ?? 0.0);
    $pente   = (float) ($p['pente'] ?? 0.0);
    $r2      = (float) ($p['r2'] ?? 0.0);
    $etaMin  = (float) ($p['eta_min'] ?? 0.0);
    $cible   = (float) ($p['cible'] ?? (defined('SEUIL_JOUR') ? SEUIL_JOUR : 5.0));
    $mode    = strtolower(trim((string) ($p['mode'] ?? 'day')));
    $secteur = $p['secteur'] ?? DEFAULT_SECTOR_NAME;
    $adresse = $p['adresse'] ?? DEFAULT_SECTOR_ADDR;
    $lat     = (float) ($p['lat'] ?? DEFAULT_SECTOR_LAT);
    $lng     = (float) ($p['lng'] ?? DEFAULT_SECTOR_LNG);
    $timeStr = date('Y-m-d H:i:s');

    // 1. Lire l'état actuel de la prédiction
    $stmt = $pdo->query('SELECT prediction_active, prediction_depuis, etat_alerte FROM etat_systeme WHERE id = 1');
    $sys = $stmt->fetch();
    if (!$sys) {
        return ['success' => false, 'error' => 'System state table is empty'];
    }

    $active = (int) ($sys['prediction_active'] ?? 0);
    $depuis = $sys['prediction_depuis'] ?? null;
    $shouldNotify = false;

    $cooldownMin = defined('PRED_COOLDOWN_MIN') ? PRED_COOLDOWN_MIN : 30;

    if ($active === 0 || empty($depuis)) {
        $shouldNotify = true;
    } else {
        $diffMin = (time() - strtotime($depuis)) / 60.0;
        if ($diffMin >= $cooldownMin) {
            $shouldNotify = true;
        }
    }

    $notifResults = [
        'telegram_envoyes' => 0,
        'destinataires'    => [],
        'journal'          => [],
    ];

    $googleMapsUrl = "https://www.google.com/maps?q={$lat},{$lng}";
    $debitFmt      = number_format($debit, 1);
    $penteFmt      = number_format($pente, 2);
    $r2Fmt         = number_format($r2, 2);
    $cibleFmt      = number_format($cible, 1);
    $targetLabel   = ($mode === 'night') ? 'night leak limit' : 'alert threshold';

    if ($etaMin < 1.0) {
        $etaSec     = max(1, (int) round($etaMin * 60));
        $etaDisplay = "{$etaSec} s";
    } else {
        $etaDisplay = round($etaMin) . " min";
    }

    $telegramBody = "🔮 <b>HydroMind — Leak prediction</b>\n\n"
                  . "📍 <b>Sector:</b> {$secteur}\n"
                  . "🏢 <b>Address:</b> {$adresse}\n"
                  . "💧 <b>Current flow:</b> <b>{$debitFmt} L/min</b>\n"
                  . "📈 <b>Trend:</b> +{$penteFmt} L/min per minute (fit R² = {$r2Fmt} over the last 12 readings)\n"
                  . "⏳ <b>Estimated time to reach {$cibleFmt} L/min ({$targetLabel}):</b> ~{$etaDisplay}\n"
                  . "🕒 <b>Timestamp:</b> {$timeStr}\n\n"
                  . "ℹ️ <i>Prediction based on flow trend — not a confirmed leak. Inspection recommended.</i>\n\n"
                  . "🗺️ <b>Direct GPS location:</b>\n"
                  . "<a href=\"{$googleMapsUrl}\">Open in Google Maps ↗</a>\n"
                  . "<code>{$googleMapsUrl}</code>";

    if ($shouldNotify) {
        // Envoi Telegram uniquement aux techniciens abonnés
        $stmtWorkers = $pdo->query(
            'SELECT id, nom_complet, telegram_chat_id, notify_telegram
             FROM workers
             WHERE notify_telegram = 1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id != \'\''
        );
        $workers = $stmtWorkers->fetchAll();

        $logInsert = $pdo->prepare(
            'INSERT INTO notifications_log (worker_id, canal, destinataire, message, statut)
             VALUES (:wid, :canal, :dest, :msg, :statut)'
        );

        foreach ($workers as $w) {
            $wid    = (int) $w['id'];
            $chatId = $w['telegram_chat_id'];

            $tgRes  = envoyerTelegram($chatId, $telegramBody);
            $statut = $tgRes['success'] ? ($tgRes['mode'] === 'TELEGRAM' ? 'ENVOYE' : 'SIMULE') : 'ERREUR';

            try {
                $logInsert->execute([
                    ':wid'    => $wid,
                    ':canal'  => 'TELEGRAM',
                    ':dest'   => $chatId,
                    ':msg'    => $telegramBody,
                    ':statut' => $statut,
                ]);
            } catch (Exception $e) {}

            $notifResults['telegram_envoyes']++;
            $notifResults['journal'][] = [
                'canal'        => 'TELEGRAM',
                'destinataire' => $chatId,
                'worker'       => $w['nom_complet'],
                'statut'       => $statut,
                'detail'       => $tgRes['detail'],
                'maps_url'     => $googleMapsUrl,
            ];
            $notifResults['destinataires'][] = $w['nom_complet'];
        }

        // Mise à jour de l'état avec prediction_depuis = NOW()
        $up = $pdo->prepare(
            'UPDATE etat_systeme
             SET prediction_active  = 1,
                 prediction_depuis  = NOW(),
                 prediction_eta_min = :eta,
                 prediction_pente   = :pente
             WHERE id = 1'
        );
        $up->execute([
            ':eta'   => $etaMin,
            ':pente' => $pente,
        ]);
    } else {
        // Cooldown en cours : mise à jour des métriques ETA et pente sans renvoyer de message
        $up = $pdo->prepare(
            'UPDATE etat_systeme
             SET prediction_active  = 1,
                 prediction_eta_min = :eta,
                 prediction_pente   = :pente
             WHERE id = 1'
        );
        $up->execute([
            ':eta'   => $etaMin,
            ':pente' => $pente,
        ]);
    }

    return [
        'success'       => true,
        'action'        => 'PREDICTION',
        'notified'      => $shouldNotify,
        'notifications' => $notifResults,
        'message_text'  => $telegramBody,
    ];
}

/**
 * Réinitialise silencieusement la prédiction active (R6) lorsque les conditions ne tiennent plus.
 *
 * @param PDO $pdo
 * @return array
 */
function notifierPredictionFin(PDO $pdo): array
{
    $pdo->exec(
        'UPDATE etat_systeme
         SET prediction_active  = 0,
             prediction_eta_min = NULL,
             prediction_pente   = NULL
         WHERE id = 1'
    );

    return [
        'success'           => true,
        'action'            => 'PREDICTION_FIN',
        'prediction_active' => 0,
    ];
}

/**
 * Gère la machine à états des alertes (NORMAL -> ALERTE -> FERMEE -> NORMAL).
 *
 * Règles strictes :
 * 1. Notifications UNIQUEMENT sur transition montante :
 *    - NORMAL -> ALERTE
 *    - NORMAL -> FERMEE
 *    - ALERTE -> FERMEE
 * 2. Même état consécutif (ex: FERMEE -> FERMEE) : AUCUNE notification.
 * 3. Retour à NORMAL :
 *    - FERMEE -> NORMAL : envoie un message court "✅ Vanne rouverte – situation normale"
 *    - ALERTE -> NORMAL : silencieux (aucune notification)
 *
 * @param PDO $pdo Connexion PDO active
 * @param string $nouvelEtat Nouvel état souhaité ('NORMAL', 'ALERTE', 'FERMEE')
 * @param string|null $type Type d'anomalie ('SEUIL', 'MICRO_FUITE', 'PIC', 'MANUEL', etc.)
 * @param float $debit Débit d'eau actuel mesuré en L/min
 * @return array Détails de la transition et résultats des notifications
 */
function changerEtatAlerte(PDO $pdo, string $nouvelEtat, ?string $type, float $debit): array
{
    $nouvelEtat = strtoupper(trim($nouvelEtat));
    if (!in_array($nouvelEtat, ['NORMAL', 'ALERTE', 'FERMEE'], true)) {
        throw new InvalidArgumentException("Nouvel état d'alerte invalide : {$nouvelEtat}");
    }

    // 1. Lire l'état actuel en base
    $stmt = $pdo->query('SELECT statut_vanne, mode_nuit, etat_alerte, type_alerte, alerte_depuis FROM etat_systeme WHERE id = 1');
    $current = $stmt->fetch();
    if (!$current) {
        throw new RuntimeException("Table etat_systeme vide.");
    }

    $ancienEtat = strtoupper($current['etat_alerte'] ?? 'NORMAL');

    // 2. Si aucun changement d'état -> pas de mise à jour ni de notification
    if ($ancienEtat === $nouvelEtat) {
        return [
            'success'       => true,
            'ancien_etat'   => $ancienEtat,
            'nouvel_etat'  => $nouvelEtat,
            'transition'   => 'INCHANGE',
            'notifie'      => false,
            'notifications'=> null,
        ];
    }

    // 3. Déterminer si transition montante (upward)
    $isUpward = (
        ($ancienEtat === 'NORMAL' && ($nouvelEtat === 'ALERTE' || $nouvelEtat === 'FERMEE')) ||
        ($ancienEtat === 'ALERTE' && $nouvelEtat === 'FERMEE')
    );

    // 4. Mettre à jour etat_systeme
    if ($nouvelEtat === 'NORMAL') {
        $up = $pdo->prepare(
            'UPDATE etat_systeme
             SET etat_alerte        = :etat,
                 type_alerte        = NULL,
                 alerte_depuis      = NULL,
                 prediction_active  = 0,
                 prediction_eta_min = NULL,
                 prediction_pente   = NULL
             WHERE id = 1'
        );
        $up->execute([':etat' => 'NORMAL']);
    } else {
        // Conserver alerte_depuis existant si on passe de ALERTE -> FERMEE, sinon date courante
        $alerteDepuis = (!empty($current['alerte_depuis']) && $ancienEtat === 'ALERTE')
            ? $current['alerte_depuis']
            : date('Y-m-d H:i:s');

        $up = $pdo->prepare(
            'UPDATE etat_systeme
             SET etat_alerte        = :etat,
                 type_alerte        = :type,
                 alerte_depuis      = :depuis,
                 prediction_active  = 0,
                 prediction_eta_min = NULL,
                 prediction_pente   = NULL
             WHERE id = 1'
        );
        $up->execute([
            ':etat'   => $nouvelEtat,
            ':type'   => $type,
            ':depuis' => $alerteDepuis,
        ]);
    }

    // Insertion dans alertes_log (historique de toutes les transitions d'état)
    try {
        $stmtLog = $pdo->prepare(
            'INSERT INTO alertes_log (etat, type, debit) VALUES (:etat, :type, :debit)'
        );
        $stmtLog->execute([
            ':etat'  => $nouvelEtat,
            ':type'  => $type,
            ':debit' => $debit,
        ]);
    } catch (Exception $e) {
        // En cas d'erreur de table, ne bloque pas la transition
    }

    // 5. Déclencher les notifications selon la transition
    $notifResults = null;
    $notifie = false;

    if ($isUpward) {
        $notifie = true;
        $notifResults = notifierTechniciens([
            'debit_eau'     => $debit,
            'statut_vanne'  => ($nouvelEtat === 'FERMEE') ? 'FERMEE' : ($current['statut_vanne'] ?? 'OUVERTE'),
            'secteur'       => DEFAULT_SECTOR_NAME,
            'adresse'       => DEFAULT_SECTOR_ADDR,
            'lat'           => DEFAULT_SECTOR_LAT,
            'lng'           => DEFAULT_SECTOR_LNG,
            'timestamp'     => date('Y-m-d H:i:s'),
            'etat_alerte'   => $nouvelEtat,
            'type_anomalie' => $type,
        ], $pdo);
    } elseif ($ancienEtat === 'FERMEE' && $nouvelEtat === 'NORMAL') {
        // FERMEE -> NORMAL : un message court "✅ Vanne rouverte – situation normale"
        $notifie = true;
        $notifResults = notifierTechniciens([
            'debit_eau'     => $debit,
            'statut_vanne'  => 'OUVERTE',
            'secteur'       => DEFAULT_SECTOR_NAME,
            'adresse'       => DEFAULT_SECTOR_ADDR,
            'lat'           => DEFAULT_SECTOR_LAT,
            'lng'           => DEFAULT_SECTOR_LNG,
            'timestamp'     => date('Y-m-d H:i:s'),
            'etat_alerte'   => 'NORMAL',
            'type_anomalie' => 'REOUVERTURE',
        ], $pdo);
    }
    // ALERTE -> NORMAL : silencieux (aucune notification)

    return [
        'success'       => true,
        'ancien_etat'   => $ancienEtat,
        'nouvel_etat'  => $nouvelEtat,
        'transition'   => "{$ancienEtat}->{$nouvelEtat}",
        'notifie'      => $notifie,
        'notifications'=> $notifResults,
    ];
}

// ── Point d'entrée direct pour test depuis l'interface ───────
if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'notifier.php') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: true');

    // Vérifier l'action
    $action = $_GET['action'] ?? $_POST['action'] ?? '';

    if ($action === 'test') {
        $worker = getLoggedInWorker();
        $pdo = getPDO();

        $testData = [
            'debit_eau'     => 8.7,
            'statut_vanne'  => 'FERMEE',
            'etat_alerte'   => 'FERMEE',
            'type_anomalie' => 'TEST',
            'secteur'       => $worker['secteur_assigne'] ?? DEFAULT_SECTOR_NAME,
            'adresse'       => DEFAULT_SECTOR_ADDR,
            'lat'           => DEFAULT_SECTOR_LAT,
            'lng'           => DEFAULT_SECTOR_LNG,
            'timestamp'     => date('Y-m-d H:i:s'),
        ];

        $res = notifierTechniciens($testData, $pdo);

        echo json_encode([
            'success' => true,
            'message' => 'Test notification triggered!',
            'data'    => $res,
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'HydroMind notification module active.'
    ]);
    exit;
}
