-- ============================================================
--  Kizuna Water — Script de création de la base de données
--  Système intelligent de détection de fuites d'eau
-- ============================================================

CREATE DATABASE IF NOT EXISTS kizuna_water
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE kizuna_water;

-- ------------------------------------------------------------
--  Table : consommation
--  Stocke chaque mesure de débit envoyée par l'ESP32
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consommation (
    id           INT           NOT NULL AUTO_INCREMENT,
    timestamp    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    debit_eau    FLOAT         NOT NULL,
    debit_evite  FLOAT         NOT NULL DEFAULT 0,
    alerte_fuite TINYINT(1)    NOT NULL DEFAULT 0,
    debit_brut   FLOAT         NULL DEFAULT NULL,
    ouverture_pct TINYINT      NOT NULL DEFAULT 100,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
--  Table : etat_systeme
--  Une seule ligne (id = 1) : état global de la vanne et machine à états
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etat_systeme (
    id                 INT                              NOT NULL,
    statut_vanne       VARCHAR(10)                      NOT NULL DEFAULT 'OUVERTE',
    mode_nuit          TINYINT(1)                       NOT NULL DEFAULT 0,
    etat_alerte        ENUM('NORMAL','ALERTE','FERMEE') NOT NULL DEFAULT 'NORMAL',
    type_alerte        VARCHAR(20)                      NULL DEFAULT NULL,
    alerte_depuis      DATETIME                         NULL DEFAULT NULL,
    prediction_active  TINYINT(1)                       NOT NULL DEFAULT 0,
    prediction_depuis  DATETIME                         NULL DEFAULT NULL,
    prediction_eta_min FLOAT                            NULL DEFAULT NULL,
    prediction_pente   FLOAT                            NULL DEFAULT NULL,
    mode_regime        ENUM('NORMAL','ECO_NUIT','EVENEMENT') NOT NULL DEFAULT 'NORMAL',
    evenement_jusqu_a  DATETIME                         NULL DEFAULT NULL,
    ouverture_manuelle TINYINT                          NULL DEFAULT NULL,
    ouverture_pct      TINYINT                          NOT NULL DEFAULT 100,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ligne unique d'état système
INSERT INTO etat_systeme (id, statut_vanne, mode_nuit, etat_alerte, type_alerte, alerte_depuis, mode_regime, evenement_jusqu_a, ouverture_manuelle, ouverture_pct)
VALUES (1, 'OUVERTE', 0, 'NORMAL', NULL, NULL, 'NORMAL', NULL, NULL, 100)
ON DUPLICATE KEY UPDATE id = id;   -- idempotent : ne réinsère pas si déjà présent

-- ------------------------------------------------------------
--  Table : profils_secteur (Profils hydrauliques et coefficients)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profils_secteur (
    secteur        VARCHAR(120) NOT NULL,
    eco_nuit_pct   TINYINT      NOT NULL DEFAULT 60,
    coef_evenement FLOAT        NOT NULL DEFAULT 1.5,
    PRIMARY KEY (secteur)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO profils_secteur (secteur, eco_nuit_pct, coef_evenement)
VALUES ('Sector A — ESPRIT Zone / El Ghazala', 60, 1.5)
ON DUPLICATE KEY UPDATE
    eco_nuit_pct = VALUES(eco_nuit_pct),
    coef_evenement = VALUES(coef_evenement);

-- ------------------------------------------------------------
--  Table : workers (Comptes techniciens & Préférences alertes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
    id                INT           NOT NULL AUTO_INCREMENT,
    nom_complet       VARCHAR(120)  NOT NULL,
    email             VARCHAR(150)  NOT NULL UNIQUE,
    telephone         VARCHAR(30)   NOT NULL,
    telegram_chat_id  VARCHAR(60)   DEFAULT NULL,
    secteur_assigne   VARCHAR(100)  NOT NULL DEFAULT 'Sector A — ESPRIT Zone / El Ghazala',
    notify_sms        TINYINT(1)    NOT NULL DEFAULT 0,
    notify_telegram   TINYINT(1)    NOT NULL DEFAULT 1,
    password_hash     VARCHAR(255)  NOT NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Compte technicien démo prêt à l'emploi (Mot de passe: Kizuna2026!)
INSERT INTO workers (id, nom_complet, email, telephone, telegram_chat_id, secteur_assigne, notify_sms, notify_telegram, password_hash)
VALUES (
    1,
    'Yassine Trabelsi',
    'technicien@kizuna.tn',
    '+21620123456',
    '123456789',
    'Sector A — ESPRIT Zone / El Ghazala',
    1,
    1,
    '$2y$10$8br3zIgL.K0skhQOJX35i.ZC.ro4FYaJCRoW0O5Vc4z6WzGPJY92q'
)
ON DUPLICATE KEY UPDATE
    nom_complet = VALUES(nom_complet),
    telephone = VALUES(telephone),
    telegram_chat_id = VALUES(telegram_chat_id),
    password_hash = VALUES(password_hash);

-- ------------------------------------------------------------
--  Table : notifications_log (Historique des alertes SMS/Telegram)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications_log (
    id                 INT           NOT NULL AUTO_INCREMENT,
    worker_id          INT           NULL,
    canal              VARCHAR(20)   NOT NULL, -- 'SMS' ou 'TELEGRAM'
    destinataire       VARCHAR(100)  NOT NULL,
    message            TEXT          NOT NULL,
    statut             VARCHAR(30)   NOT NULL DEFAULT 'SIMULE', -- 'ENVOYE' ou 'SIMULE' ou 'ERREUR'
    date_envoi         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
--  Table : alertes_log (Historique des transitions d'état d'alerte)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertes_log (
    id         INT                                 NOT NULL AUTO_INCREMENT,
    etat       ENUM('ALERTE', 'FERMEE', 'NORMAL')  NOT NULL,
    type       VARCHAR(20)                         NULL DEFAULT NULL,
    debit      FLOAT                               NOT NULL DEFAULT 0,
    created_at DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
--  Données de démo pour la consommation
-- ------------------------------------------------------------
INSERT INTO consommation (timestamp, debit_eau, alerte_fuite) VALUES
    (NOW() - INTERVAL 29 MINUTE,  2.1, 0),
    (NOW() - INTERVAL 28 MINUTE,  2.0, 0),
    (NOW() - INTERVAL 27 MINUTE,  2.3, 0),
    (NOW() - INTERVAL 26 MINUTE,  1.9, 0),
    (NOW() - INTERVAL 25 MINUTE,  2.2, 0),
    (NOW() - INTERVAL 24 MINUTE,  8.7, 1),
    (NOW() - INTERVAL 23 MINUTE,  9.1, 1),
    (NOW() - INTERVAL 22 MINUTE,  8.5, 1),
    (NOW() - INTERVAL 21 MINUTE,  2.0, 0),
    (NOW() - INTERVAL 20 MINUTE,  2.1, 0);
