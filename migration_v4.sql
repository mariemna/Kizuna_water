-- ============================================================
--  Kizuna Water — Migration v4 : R6 Prédiction de fuite
--  Ajout des colonnes de prédiction dans etat_systeme
-- ============================================================

USE kizuna_water;

ALTER TABLE etat_systeme
    ADD COLUMN prediction_active TINYINT(1) NOT NULL DEFAULT 0 AFTER alerte_depuis,
    ADD COLUMN prediction_depuis DATETIME NULL DEFAULT NULL AFTER prediction_active,
    ADD COLUMN prediction_eta_min FLOAT NULL DEFAULT NULL AFTER prediction_depuis,
    ADD COLUMN prediction_pente FLOAT NULL DEFAULT NULL AFTER prediction_eta_min;
