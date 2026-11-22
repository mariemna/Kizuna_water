<?php
// ============================================================
//  HydroMind — Configuration de la connexion PDO & Notifications
// ============================================================

// ── Fuseau horaire uniforme (Tunisie - UTC+1) ─────────────────
date_default_timezone_set('Africa/Tunis');

define('DB_HOST', 'localhost');
define('DB_NAME', 'kizuna_water');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

// ── Seuils et Constantes de Détection de Fuite ───────────────
define('SEUIL_JOUR', 5.0);
define('SEUIL_NUIT', 1.0);
define('SEUIL_RUPTURE', 8.0);
define('N_RUPTURE', 3);
define('N_SOUTENU', 5);
define('MICRO_RATIO', 0.5);
define('ZSCORE_SEUIL', 2.0);
define('STD_MIN', 0.5);
define('SAUT_MIN', 3.0);

// ── Constantes Régimes et Contrôle de Débit ──────────────────
define('ECO_NUIT_PCT', 60);
define('EVENT_COEF', 1.5);

// ── Constantes R6 Prédiction de Fuite ────────────────────────
define('N_PRED', 12);
define('PRED_PENTE_MIN', 0.05);     // L/min par mesure
define('PRED_R2_MIN', 0.6);
define('PRED_HAUSSE_MIN', 0.5);     // L/min hausse minimale sur la fenêtre
define('PRED_COOLDOWN_MIN', 30);    // Cooldown entre deux notifications Telegram (minutes)
define('PRED_ETA_MAX_MIN', 120);    // Horizon max prédiction (minutes)

// ── Configuration Notifications Alertes ──────────────────────

// Twilio SMS (Optionnel — Si non configuré, le mode simulation s'active sans erreur)
define('TWILIO_SID', '');        // ex: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
define('TWILIO_TOKEN', '');      // ex: 'your_auth_token'
define('TWILIO_FROM', '');       // ex: '+1234567890'

// Telegram Bot (Optionnel — Si non configuré, le mode simulation s'active sans erreur)
define('TELEGRAM_BOT_TOKEN', '9289782065:AAHoitTrusyPvKrNKnqHZDv1n-_qlq7I5vI'); // ex: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'

// Site & Coordonnées GPS par défaut pour l'alerte Secteur A
define('DEFAULT_SECTOR_NAME', 'Sector A — ESPRIT Zone / El Ghazala');
define('DEFAULT_SECTOR_ADDR', 'ESPRIT Campus / El Ghazala Technology Park, Ariana');
define('DEFAULT_SECTOR_LAT', 36.8990);
define('DEFAULT_SECTOR_LNG', 10.1895);

/**
 * Retourne une instance PDO partagée (singleton léger).
 * Lance une PDOException en cas d'échec — à catcher côté appelant.
 */
function getPDO(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST,
            DB_NAME,
            DB_CHARSET
        );

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        $pdo->exec("SET time_zone = '+01:00'");
    }

    return $pdo;
}
