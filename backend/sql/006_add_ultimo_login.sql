-- ============================================================
--  Agisad – Agrega columna ultimo_login en usuarios v6
--  Aplicar despues de 001..005
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN ultimo_login DATETIME NULL AFTER activo;
