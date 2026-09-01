-- Preferencias de notificacion por mail para turnos nuevos y cancelaciones,
-- generales (medicos) y por tipo de turno especifico (medico_tipos_turno).

ALTER TABLE medicos
  ADD COLUMN notif_turno_nuevo TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN notif_cancelacion TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE medico_tipos_turno
  ADD COLUMN notificar_nuevo TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE turnos
  ADD COLUMN id_tipo_turno INT UNSIGNED NULL AFTER id_clinica,
  ADD CONSTRAINT fk_turno_tipo_turno
    FOREIGN KEY (id_tipo_turno) REFERENCES medico_tipos_turno (id_tipo_turno)
    ON DELETE SET NULL;
