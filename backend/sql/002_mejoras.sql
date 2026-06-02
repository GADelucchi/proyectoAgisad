-- ============================================================
--  Agisad – Mejoras de esquema v2
--  Aplicar DESPUÉS de 001_schema_base.sql
-- ============================================================

-- 1. Tokens de recuperación de contraseña
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id_token    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_usuario  INT UNSIGNED  NOT NULL,
  token_hash  VARCHAR(64)   NOT NULL COMMENT 'SHA-256 del token en claro (nunca se guarda el token real)',
  expira_en   DATETIME      NOT NULL,
  usado_en    DATETIME      NULL,
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_token),
  INDEX idx_prt_usuario_expira (id_usuario, expira_en),
  INDEX idx_prt_token_hash     (token_hash),
  CONSTRAINT fk_prt_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 2. Términos y condiciones por médico (versionados)
-- --------------------------------------------------------
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

-- 3. Aceptaciones de TyC por paciente y médico
-- --------------------------------------------------------
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

-- 4. Excepciones de agenda (bloqueos y horas extra puntuales)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS medico_disponibilidad_excepciones (
  id_excepcion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico    INT UNSIGNED NOT NULL,
  id_clinica   INT UNSIGNED NOT NULL,
  fecha        DATE         NOT NULL,
  hora_inicio  TIME         NULL COMMENT 'NULL = todo el día',
  hora_fin     TIME         NULL COMMENT 'NULL = todo el día',
  tipo         ENUM('bloqueo', 'extra') NOT NULL DEFAULT 'bloqueo',
  motivo       VARCHAR(255) NULL,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_excepcion),
  INDEX idx_excepcion_medico_fecha (id_medico, id_clinica, fecha),
  CONSTRAINT fk_exc_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE,
  CONSTRAINT fk_exc_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 5. Permisos por módulo de cada asistente, segmentados por médico
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistente_permisos (
  id_asistente  INT UNSIGNED NOT NULL,
  id_medico     INT UNSIGNED NOT NULL,
  agenda        TINYINT(1)  NOT NULL DEFAULT 1,
  pacientes     TINYINT(1)  NOT NULL DEFAULT 0,
  mensajes      TINYINT(1)  NOT NULL DEFAULT 0,
  recetas       TINYINT(1)  NOT NULL DEFAULT 0,
  configuracion TINYINT(1)  NOT NULL DEFAULT 0,
  bloqueado     TINYINT(1)  NOT NULL DEFAULT 0,
  creado_en     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_asistente, id_medico),
  CONSTRAINT fk_aperms_asistente
    FOREIGN KEY (id_asistente) REFERENCES asistentes (id_asistente)
    ON DELETE CASCADE,
  CONSTRAINT fk_aperms_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 6. Índices extra de performance en tablas existentes
-- --------------------------------------------------------
ALTER TABLE turnos
  ADD INDEX idx_turnos_medico_fecha_estado (id_medico, id_clinica, fecha, estado),
  ADD INDEX idx_turnos_paciente_fecha      (id_paciente, fecha, estado);

ALTER TABLE medico_clinicas
  ADD INDEX idx_mc_clinica_activo (id_clinica, activo);

ALTER TABLE medico_disponibilidad
  ADD INDEX idx_mdisponib_medico_clinica_dia (id_medico, id_clinica, dia_semana, activo);
