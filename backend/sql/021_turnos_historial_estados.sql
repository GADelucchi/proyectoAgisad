-- ============================================================
--  Agisad – Alineación de estados en turnos_historial v21
--  La v18 amplió el ENUM de `turnos` pero no el del historial,
--  así que registrar un cambio a en_curso / completado /
--  cancelado_paciente / cancelado_clinica fallaba.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

ALTER TABLE turnos_historial
  MODIFY COLUMN estado_previo ENUM(
    'pendiente',
    'confirmado',
    'en_curso',
    'completado',
    'cancelado',
    'cancelado_paciente',
    'cancelado_clinica',
    'ausente',
    'realizado'
  ) NULL,
  MODIFY COLUMN estado_nuevo ENUM(
    'pendiente',
    'confirmado',
    'en_curso',
    'completado',
    'cancelado',
    'cancelado_paciente',
    'cancelado_clinica',
    'ausente',
    'realizado'
  ) NOT NULL;
