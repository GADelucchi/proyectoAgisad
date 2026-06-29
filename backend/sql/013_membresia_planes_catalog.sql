-- ============================================================
--  Agisad – Catalogo de planes de membresia v13
--  Aplicar DESPUES de 004_admin_finanzas.sql
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

CREATE TABLE IF NOT EXISTS membresia_planes (
  id_plan       SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo        VARCHAR(40)       NOT NULL,
  nombre        VARCHAR(80)       NOT NULL,
  descripcion   VARCHAR(255)      NULL,
  activo        TINYINT(1)        NOT NULL DEFAULT 1,
  creado_en     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME         NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_plan),
  UNIQUE KEY uq_membresia_plan_codigo (codigo),
  UNIQUE KEY uq_membresia_plan_nombre (nombre)
) ENGINE = InnoDB;

INSERT IGNORE INTO membresia_planes (codigo, nombre, descripcion, activo)
VALUES
  ('profesional', 'Profesional', 'Plan individual para medicos', 1),
  ('gestion', 'Gestion', 'Plan para gerentes y administracion multi-clinica', 1),
  ('legacy', 'Legacy', 'Plan historico heredado', 1);

ALTER TABLE membresias
  ADD COLUMN id_plan SMALLINT UNSIGNED NULL AFTER id_usuario;

UPDATE membresias m
INNER JOIN membresia_planes mp ON mp.codigo = m.plan
SET m.id_plan = mp.id_plan
WHERE m.id_plan IS NULL;

ALTER TABLE membresias
  ADD INDEX idx_membresias_plan (id_plan);

ALTER TABLE membresias
  ADD CONSTRAINT fk_membresia_plan
  FOREIGN KEY (id_plan) REFERENCES membresia_planes (id_plan)
  ON DELETE SET NULL;
