-- ============================================================
--  Agisad – Solicitudes de mensajes de pacientes a medicos
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

CREATE TABLE IF NOT EXISTS mensaje_solicitudes (
  id_solicitud      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_paciente       INT UNSIGNED    NOT NULL,
  id_medico         INT UNSIGNED    NOT NULL,
  asunto            VARCHAR(150)    NOT NULL,
  mensaje           TEXT            NOT NULL,
  estado            ENUM('enviada','leida','respondida','cerrada') NOT NULL DEFAULT 'enviada',
  enviado_a_email   VARCHAR(150)    NOT NULL,
  creado_en         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_solicitud),
  INDEX idx_ms_medico_estado (id_medico, estado),
  INDEX idx_ms_paciente (id_paciente),
  CONSTRAINT fk_ms_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
    ON DELETE CASCADE,
  CONSTRAINT fk_ms_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;
