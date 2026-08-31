-- ============================================================
--  Agisad – Invitaciones de gerente a médicos v22
--  Un gerente invita médicos a su clínica por email. Si el médico
--  no tiene membresía propia, queda cubierto por gerente_medico_beneficios
--  (ya existente desde la migración 004) en vez de pagar plan propio.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

CREATE TABLE IF NOT EXISTS gerente_invitaciones (
  id_invitacion        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_gerente           INT UNSIGNED NOT NULL,
  id_clinica           INT UNSIGNED NOT NULL,
  email_invitado       VARCHAR(180) NOT NULL,
  token_hash           CHAR(64)     NOT NULL,
  estado               ENUM('pendiente', 'aceptada', 'revocada', 'expirada') NOT NULL DEFAULT 'pendiente',
  id_medico_resultante INT UNSIGNED NULL,
  expira_en            DATETIME     NOT NULL,
  aceptada_en          DATETIME     NULL,
  creado_en            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_invitacion),
  UNIQUE KEY uq_gi_token (token_hash),
  INDEX idx_gi_gerente_estado (id_gerente, estado),
  CONSTRAINT fk_gi_gerente
    FOREIGN KEY (id_gerente) REFERENCES gerentes (id_gerente)
    ON DELETE CASCADE,
  CONSTRAINT fk_gi_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE,
  CONSTRAINT fk_gi_medico
    FOREIGN KEY (id_medico_resultante) REFERENCES medicos (id_medico)
    ON DELETE SET NULL
) ENGINE = InnoDB;
