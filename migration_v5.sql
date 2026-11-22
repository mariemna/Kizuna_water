-- ============================================================
--  HydroMind — migration_v5.sql
--  Migration vers le contrôle de débit (Flow Control)
-- ============================================================

USE kizuna_water;

-- 1. Table etat_systeme : nouveaux attributs de régime et ouverture
ALTER TABLE etat_systeme
    ADD COLUMN mode_regime ENUM('NORMAL','ECO_NUIT','EVENEMENT') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN evenement_jusqu_a DATETIME NULL DEFAULT NULL,
    ADD COLUMN ouverture_manuelle TINYINT NULL DEFAULT NULL,
    ADD COLUMN ouverture_pct TINYINT NOT NULL DEFAULT 100;

-- 2. Table consommation : débit brut (demande) et pourcentage d'ouverture
ALTER TABLE consommation
    ADD COLUMN debit_brut FLOAT NULL DEFAULT NULL,
    ADD COLUMN ouverture_pct TINYINT NOT NULL DEFAULT 100;

-- Mise à jour rétroactive des mesures existantes
UPDATE consommation SET ouverture_pct = 0 WHERE debit_evite > 0;
UPDATE consommation SET debit_brut = debit_eau + debit_evite WHERE debit_brut IS NULL;

-- 3. Table profils_secteur : profils par secteur avec valeurs par défaut
CREATE TABLE IF NOT EXISTS profils_secteur (
    secteur        VARCHAR(120) NOT NULL,
    eco_nuit_pct   TINYINT      NOT NULL DEFAULT 60,
    coef_evenement FLOAT        NOT NULL DEFAULT 1.5,
    PRIMARY KEY (secteur)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Remplissage initial du secteur A
INSERT INTO profils_secteur (secteur, eco_nuit_pct, coef_evenement)
VALUES ('Sector A — ESPRIT Zone / El Ghazala', 60, 1.5)
ON DUPLICATE KEY UPDATE
    eco_nuit_pct   = VALUES(eco_nuit_pct),
    coef_evenement = VALUES(coef_evenement);
