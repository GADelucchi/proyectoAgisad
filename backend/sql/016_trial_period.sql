-- ============================================================
--  Agisad – Trial / Período de prueba v16
--  Implementa período de prueba de 30 días para nuevas membresías
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- Agregar campos de trial a tabla membresias
ALTER TABLE membresias
  ADD COLUMN fecha_inicio_trial DATE NULL DEFAULT NULL AFTER pagado_hasta,
  ADD COLUMN fecha_fin_trial DATE NULL DEFAULT NULL AFTER fecha_inicio_trial,
  ADD COLUMN es_trial TINYINT(1) NOT NULL DEFAULT 0 AFTER fecha_fin_trial;

-- Crear índices para optimizar búsquedas de membresías en trial
ALTER TABLE membresias
  ADD INDEX idx_membresias_trial (es_trial, fecha_fin_trial);
