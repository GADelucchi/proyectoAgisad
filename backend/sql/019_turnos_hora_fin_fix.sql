-- ============================================================
--  Agisad – Corrección de hora_fin en turnos v19
--  El alta de turnos calculaba mal los minutos (tomaba solo el
--  primer dígito), por lo que quedaron hora_fin inválidas.
--  Se normalizan a 30 minutos, la duración por defecto.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

UPDATE turnos
SET hora_fin = ADDTIME(hora_inicio, '00:30:00')
WHERE hora_fin IS NULL
   OR hora_fin <= hora_inicio
   OR TIMESTAMPDIFF(MINUTE, hora_inicio, hora_fin) < 15;
