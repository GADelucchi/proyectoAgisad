-- Publicar consultorios para alquiler pasa a ser un adicional pago sobre la
-- membresía del médico, en vez de una feature incluida en los planes altos.
--
-- membresia_planes.permite_publicar_consultorio cambia de significado:
-- ya no es "puede publicar" sino "puede CONTRATAR el adicional".
-- La capacidad real la da una fila activa en medico_adicional_consultorios.

UPDATE membresia_planes
SET permite_publicar_consultorio = 1
WHERE codigo IN ('medio', 'profesional', 'empresarial');

UPDATE membresia_planes
SET permite_publicar_consultorio = 0
WHERE codigo = 'inicial';

-- El propietario puro no contrata adicional: su plan ya es exactamente esto.
UPDATE membresia_planes
SET precio_mensual = 39999.00
WHERE codigo = 'espacios';

CREATE TABLE IF NOT EXISTS medico_adicional_consultorios (
  id_adicional   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico      INT UNSIGNED NOT NULL,
  estado         ENUM('pendiente', 'activo', 'rechazado', 'cancelado') NOT NULL DEFAULT 'pendiente',
  monto_mensual  DECIMAL(12,2) NOT NULL DEFAULT 20000.00,
  max_consultorios TINYINT UNSIGNED NOT NULL DEFAULT 2,
  solicitado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activado_en    DATETIME NULL,
  cancelado_en   DATETIME NULL,
  activado_por   INT UNSIGNED NULL COMMENT 'id_usuario del admin que lo activó',
  PRIMARY KEY (id_adicional),
  INDEX idx_mac_medico_estado (id_medico, estado),
  CONSTRAINT fk_mac_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE,
  CONSTRAINT fk_mac_admin
    FOREIGN KEY (activado_por) REFERENCES usuarios (id_usuario)
    ON DELETE SET NULL
) ENGINE = InnoDB;
