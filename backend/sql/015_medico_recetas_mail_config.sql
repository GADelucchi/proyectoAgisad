-- ============================================================
--  Agisad - Configuracion de recetas por mail (v15)
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

ALTER TABLE medicos
  ADD COLUMN enviar_recetas_mail TINYINT(1) NOT NULL DEFAULT 1 AFTER activo;
