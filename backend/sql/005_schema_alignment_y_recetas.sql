-- ============================================================
--  Agisad – Alineación schema + recetas v5
--  Objetivo: compatibilidad entre DB real y backend actual.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- 1) Permisos de asistentes por médico (requerido por módulos backend)
CREATE TABLE IF NOT EXISTS asistente_permisos (
  id_asistente   INT UNSIGNED NOT NULL,
  id_medico      INT UNSIGNED NOT NULL,
  agenda         TINYINT(1)   NOT NULL DEFAULT 1,
  pacientes      TINYINT(1)   NOT NULL DEFAULT 0,
  mensajes       TINYINT(1)   NOT NULL DEFAULT 0,
  recetas        TINYINT(1)   NOT NULL DEFAULT 0,
  configuracion  TINYINT(1)   NOT NULL DEFAULT 0,
  bloqueado      TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_asistente, id_medico),
  CONSTRAINT fk_ap_asistente
    FOREIGN KEY (id_asistente) REFERENCES asistentes (id_asistente)
    ON DELETE CASCADE,
  CONSTRAINT fk_ap_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Nota: la ejecución es idempotente porque el migrador ignora ER_DUP_FIELDNAME.
ALTER TABLE medicos ADD COLUMN bio TEXT NULL;
ALTER TABLE medicos ADD COLUMN foto_url VARCHAR(500) NULL;
ALTER TABLE medicos ADD COLUMN acepta_tyc TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE medicos ADD COLUMN acepta_tyc_fecha DATETIME NULL;
ALTER TABLE medicos ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1;

-- 3) Solicitudes de recetas de pacientes a médicos
CREATE TABLE IF NOT EXISTS receta_solicitudes (
  id_solicitud      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_paciente       INT UNSIGNED    NOT NULL,
  id_medico         INT UNSIGNED    NOT NULL,
  tipo              ENUM('estandar','urgente') NOT NULL DEFAULT 'estandar',
  items_json        JSON            NOT NULL,
  estado            ENUM('enviada','leida','resuelta','rechazada') NOT NULL DEFAULT 'enviada',
  enviado_a_email   VARCHAR(150)    NOT NULL,
  creado_en         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_solicitud),
  INDEX idx_rs_medico_estado (id_medico, estado),
  INDEX idx_rs_paciente (id_paciente),
  CONSTRAINT fk_rs_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
    ON DELETE CASCADE,
  CONSTRAINT fk_rs_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;
