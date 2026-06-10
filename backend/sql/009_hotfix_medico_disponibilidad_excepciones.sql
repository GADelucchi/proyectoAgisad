-- Hotfix: crear tabla de excepciones de disponibilidad si falta
CREATE TABLE IF NOT EXISTS medico_disponibilidad_excepciones (
  id_excepcion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico    INT UNSIGNED NOT NULL,
  id_clinica   INT UNSIGNED NOT NULL,
  fecha        DATE         NOT NULL,
  hora_inicio  TIME         NULL,
  hora_fin     TIME         NULL,
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