-- ============================================================
--  Agisad – Verificación de email por código OTP v23
--  Código de 6 dígitos, un solo uso, con límite de intentos.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

CREATE TABLE IF NOT EXISTS email_verificaciones (
  id_verificacion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario      INT UNSIGNED NOT NULL,
  codigo_hash     CHAR(64)     NOT NULL,
  intentos        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expira_en       DATETIME     NOT NULL,
  usado_en        DATETIME     NULL,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_verificacion),
  INDEX idx_ev_usuario (id_usuario, usado_en, expira_en),
  CONSTRAINT fk_ev_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;
