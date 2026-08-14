-- ============================================================
--  Agisad – Agregar columna dni a medicos v17
--  Permite registrar DNI de médicos
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- Agregar columna dni a tabla medicos
ALTER TABLE medicos
  ADD COLUMN dni VARCHAR(12) NULL UNIQUE AFTER id_usuario;
