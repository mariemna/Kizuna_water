-- ============================================================
--  Kizuna Water — Migration v3 : Table historique des alertes
--  Stocke chaque transition d'état de la machine à alertes
-- ============================================================

USE kizuna_water;

CREATE TABLE IF NOT EXISTS alertes_log (
    id         INT                                 NOT NULL AUTO_INCREMENT,
    etat       ENUM('ALERTE', 'FERMEE', 'NORMAL')  NOT NULL,
    type       VARCHAR(20)                         NULL DEFAULT NULL,
    debit      FLOAT                               NOT NULL DEFAULT 0,
    created_at DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
