-- ============================================================
--  Agisad – Alineación de estados de turnos v18
--  El código usa en_curso / completado / cancelado_paciente /
--  cancelado_clinica, que no existían en el ENUM original.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

ALTER TABLE turnos
  MODIFY COLUMN estado ENUM(
    'pendiente',
    'confirmado',
    'en_curso',
    'completado',
    'cancelado',
    'cancelado_paciente',
    'cancelado_clinica',
    'ausente',
    'realizado'
  ) NOT NULL DEFAULT 'pendiente';

UPDATE turnos SET estado = 'cancelado_paciente' WHERE estado = 'cancelado';
UPDATE turnos SET estado = 'completado' WHERE estado = 'realizado';
