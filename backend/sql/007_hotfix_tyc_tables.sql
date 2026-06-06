-- ============================================================
--  Agisad – Hotfix v7
--  Crea tablas TyC si faltan en DBs desalineadas
-- ============================================================

CREATE TABLE IF NOT EXISTS medico_tyc (
  id_tyc     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_medico  INT UNSIGNED  NOT NULL,
  version    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  texto      TEXT          NOT NULL,
  activo     TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tyc),
  UNIQUE KEY uq_medico_version (id_medico, version),
  CONSTRAINT fk_tyc_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS paciente_tyc_aceptaciones (
  id_paciente INT UNSIGNED  NOT NULL,
  id_medico   INT UNSIGNED  NOT NULL,
  id_tyc      INT UNSIGNED  NOT NULL,
  aceptado_en DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip          VARCHAR(45)   NULL,
  PRIMARY KEY (id_paciente, id_tyc),
  CONSTRAINT fk_ptyc_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
    ON DELETE CASCADE,
  CONSTRAINT fk_ptyc_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE,
  CONSTRAINT fk_ptyc_tyc
    FOREIGN KEY (id_tyc) REFERENCES medico_tyc (id_tyc)
    ON DELETE CASCADE
) ENGINE = InnoDB;