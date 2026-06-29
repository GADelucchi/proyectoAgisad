-- Configuracion general de turnos y tipos de turno personalizados por medico

CREATE TABLE IF NOT EXISTS medico_turnos_config (
  id_medico                INT UNSIGNED      NOT NULL,
  duracion_turno_estandar  SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  creado_en                DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_medico),
  CONSTRAINT fk_mtc_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS medico_tipos_turno (
  id_tipo_turno   INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_medico       INT UNSIGNED      NOT NULL,
  nombre          VARCHAR(120)      NOT NULL,
  duracion_minutos SMALLINT UNSIGNED NOT NULL,
  activo          TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en       DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tipo_turno),
  INDEX idx_mtt_medico_activo (id_medico, activo),
  CONSTRAINT fk_mtt_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;