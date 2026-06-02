-- ============================================================
--  Agisad – Relaciones de negocio v3
--  Aplicar DESPUÉS de 001_schema_base.sql y 002_mejoras.sql
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- 0) Nuevo rol: gerente
INSERT IGNORE INTO roles (nombre) VALUES ('gerente');

-- 1) Perfil de gerentes (usuario autenticado + datos de negocio)
CREATE TABLE IF NOT EXISTS gerentes (
  id_gerente  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario  INT UNSIGNED NOT NULL,
  nombre      VARCHAR(80)  NOT NULL,
  apellido    VARCHAR(80)  NOT NULL,
  telefono    VARCHAR(25)  NULL,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_gerente),
  UNIQUE KEY uq_gerente_usuario (id_usuario),
  CONSTRAINT fk_gerente_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 2) Clínicas administradas por gerente
-- Regla de negocio actual: una clínica pertenece a un único gerente.
CREATE TABLE IF NOT EXISTS gerente_clinicas (
  id_gerente   INT UNSIGNED NOT NULL,
  id_clinica   INT UNSIGNED NOT NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME   NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_gerente, id_clinica),
  UNIQUE KEY uq_gc_clinica_unica (id_clinica),
  INDEX idx_gc_gerente_activo (id_gerente, activo),
  CONSTRAINT fk_gc_gerente
    FOREIGN KEY (id_gerente) REFERENCES gerentes (id_gerente)
    ON DELETE CASCADE,
  CONSTRAINT fk_gc_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 3) Asistentes asignados a clínica (alta hecha por gerente)
-- Un asistente puede trabajar en varias clínicas.
CREATE TABLE IF NOT EXISTS asistente_clinicas (
  id_asistente  INT UNSIGNED NOT NULL,
  id_clinica    INT UNSIGNED NOT NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME    NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_asistente, id_clinica),
  INDEX idx_ac_clinica_activo (id_clinica, activo),
  CONSTRAINT fk_ac_asistente
    FOREIGN KEY (id_asistente) REFERENCES asistentes (id_asistente)
    ON DELETE CASCADE,
  CONSTRAINT fk_ac_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 4) Vínculo paciente ↔ médico/clinica para control de visibilidad
-- Evita mostrar pacientes globales: sólo los vinculados al médico/clinica.
CREATE TABLE IF NOT EXISTS paciente_vinculos (
  id_vinculo      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_paciente     INT UNSIGNED    NOT NULL,
  id_medico       INT UNSIGNED    NOT NULL,
  id_clinica      INT UNSIGNED    NOT NULL,
  origen          ENUM('turno','manual','importacion') NOT NULL DEFAULT 'turno',
  estado          ENUM('activo','archivado','bloqueado') NOT NULL DEFAULT 'activo',
  primera_atencion DATETIME       NULL,
  ultima_atencion DATETIME        NULL,
  creado_en       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_vinculo),
  UNIQUE KEY uq_pv_paciente_medico_clinica (id_paciente, id_medico, id_clinica),
  INDEX idx_pv_medico_estado (id_medico, estado),
  INDEX idx_pv_clinica_estado (id_clinica, estado),
  INDEX idx_pv_paciente_estado (id_paciente, estado),
  CONSTRAINT fk_pv_paciente
    FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente)
    ON DELETE CASCADE,
  CONSTRAINT fk_pv_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE,
  CONSTRAINT fk_pv_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- 5) Trigger opcional de consistencia de vinculo desde turnos
-- Nota: para MySQL sin CREATE TRIGGER IF NOT EXISTS, usar DROP + CREATE.
DROP TRIGGER IF EXISTS trg_turnos_crea_vinculo_paciente;
DELIMITER $$
CREATE TRIGGER trg_turnos_crea_vinculo_paciente
AFTER INSERT ON turnos
FOR EACH ROW
BEGIN
  INSERT INTO paciente_vinculos (
    id_paciente, id_medico, id_clinica, origen, estado, primera_atencion, ultima_atencion
  ) VALUES (
    NEW.id_paciente, NEW.id_medico, NEW.id_clinica, 'turno', 'activo', NOW(), NOW()
  )
  ON DUPLICATE KEY UPDATE
    estado = 'activo',
    ultima_atencion = NOW();
END$$
DELIMITER ;
