-- ============================================================
--  Kizuna Water — Migration v2 : Machine à états des alertes
--  Ajout des colonnes etat_alerte, type_alerte, alerte_depuis
-- ============================================================

USE kizuna_water;

ALTER TABLE etat_systeme
    ADD COLUMN etat_alerte ENUM('NORMAL','ALERTE','FERMEE') NOT NULL DEFAULT 'NORMAL' AFTER mode_nuit,
    ADD COLUMN type_alerte VARCHAR(20) NULL DEFAULT NULL AFTER etat_alerte,
    ADD COLUMN alerte_depuis DATETIME NULL DEFAULT NULL AFTER type_alerte;

-- Règle physique : stockage du débit évité quand la vanne est coupée
ALTER TABLE consommation
    ADD COLUMN debit_evite FLOAT NOT NULL DEFAULT 0 AFTER debit_eau;
