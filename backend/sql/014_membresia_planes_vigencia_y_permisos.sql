-- ============================================================
--  Agisad - Membresias v14
--  Unifica planes publicos + vigencia + permisos por modulo
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

ALTER TABLE membresia_planes
  ADD COLUMN vigencia_meses TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER descripcion,
  ADD COLUMN precio_mensual DECIMAL(12,2) NULL AFTER vigencia_meses,
  ADD COLUMN permite_turnos TINYINT(1) NOT NULL DEFAULT 1 AFTER precio_mensual,
  ADD COLUMN permite_asistentes TINYINT(1) NOT NULL DEFAULT 1 AFTER permite_turnos,
  ADD COLUMN limite_asistentes SMALLINT UNSIGNED NULL AFTER permite_asistentes;

INSERT INTO membresia_planes (
  codigo,
  nombre,
  descripcion,
  vigencia_meses,
  precio_mensual,
  permite_turnos,
  permite_asistentes,
  limite_asistentes,
  activo
)
VALUES
  ('inicial', 'Inicial', 'Plan base para profesionales que recien arrancan', 1, 29999.00, 0, 0, 0, 1),
  ('medio', 'Medio', 'Plan intermedio con agenda y automatizaciones', 1, 49999.00, 1, 0, 0, 1),
  ('profesional', 'Profesional', 'Plan completo para profesionales', 1, 74999.00, 1, 1, 2, 1),
  ('empresarial', 'Empresarial', 'Plan multi-clinica para equipos grandes', 1, 119999.00, 1, 1, 5, 1)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  vigencia_meses = VALUES(vigencia_meses),
  precio_mensual = VALUES(precio_mensual),
  permite_turnos = VALUES(permite_turnos),
  permite_asistentes = VALUES(permite_asistentes),
  limite_asistentes = VALUES(limite_asistentes),
  activo = VALUES(activo);

UPDATE membresias
SET plan = 'inicial'
WHERE LOWER(plan) IN ('starter', 'inicial');

UPDATE membresias
SET plan = 'medio'
WHERE LOWER(plan) IN ('medium', 'medio');

UPDATE membresias
SET plan = 'profesional'
WHERE LOWER(plan) IN ('professional', 'profesional');

UPDATE membresias
SET plan = 'empresarial'
WHERE LOWER(plan) IN ('gestion', 'empresarial');

UPDATE membresia_planes
SET codigo = 'inicial',
    nombre = 'Inicial',
    descripcion = 'Plan base para profesionales que recien arrancan',
    vigencia_meses = 1,
    precio_mensual = 29999.00,
    permite_turnos = 0,
    permite_asistentes = 0,
    limite_asistentes = 0,
    activo = 1
WHERE LOWER(codigo) IN ('starter', 'inicial') OR LOWER(nombre) IN ('starter', 'inicial');

UPDATE membresia_planes
SET codigo = 'medio',
    nombre = 'Medio',
    descripcion = 'Plan intermedio con agenda y automatizaciones',
    vigencia_meses = 1,
    precio_mensual = 49999.00,
    permite_turnos = 1,
    permite_asistentes = 0,
    limite_asistentes = 0,
    activo = 1
WHERE LOWER(codigo) IN ('medium', 'medio') OR LOWER(nombre) IN ('medium', 'medio');

UPDATE membresia_planes
SET codigo = 'profesional',
    nombre = 'Profesional',
    descripcion = 'Plan completo para profesionales',
    vigencia_meses = 1,
    precio_mensual = 74999.00,
    permite_turnos = 1,
    permite_asistentes = 1,
    limite_asistentes = 2,
    activo = 1
WHERE LOWER(codigo) IN ('professional', 'profesional') OR LOWER(nombre) IN ('professional', 'profesional');

UPDATE membresia_planes
SET codigo = 'empresarial',
    nombre = 'Empresarial',
    descripcion = 'Plan multi-clinica para equipos grandes',
    vigencia_meses = 1,
    precio_mensual = 119999.00,
    permite_turnos = 1,
    permite_asistentes = 1,
    limite_asistentes = 5,
    activo = 1
WHERE LOWER(codigo) IN ('gestion', 'empresarial') OR LOWER(nombre) IN ('gestion', 'empresarial');

UPDATE membresias m
INNER JOIN membresia_planes mp
  ON LOWER(mp.codigo) = LOWER(m.plan)
SET m.id_plan = mp.id_plan
WHERE m.id_plan IS NULL;
