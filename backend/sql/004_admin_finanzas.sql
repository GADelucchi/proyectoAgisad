-- ============================================================
--  Agisad – Admin + finanzas v4
--  Aplicar DESPUES de 001_schema_base.sql, 002_mejoras.sql y 003_relaciones_negocio.sql
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- Membresias por usuario (medico o gerente)
CREATE TABLE IF NOT EXISTS membresias (
  id_membresia   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED NOT NULL,
  plan           VARCHAR(40)  NOT NULL,
  estado         ENUM('activa', 'cancelada', 'vencida') NOT NULL DEFAULT 'activa',
  fecha_inicio   DATE         NOT NULL,
  fecha_fin      DATE         NULL,
  monto_mensual  DECIMAL(12,2) NULL,
  pagado_hasta   DATE         NULL,
  auto_renueva   TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_membresia),
  INDEX idx_membresias_usuario (id_usuario, creado_en),
  INDEX idx_membresias_estado (estado),
  CONSTRAINT fk_membresia_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Pagos de membresias
CREATE TABLE IF NOT EXISTS pagos_membresia (
  id_pago          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_membresia     INT UNSIGNED NOT NULL,
  monto            DECIMAL(12,2) NOT NULL,
  moneda           CHAR(3) NOT NULL DEFAULT 'ARS',
  metodo           ENUM('manual', 'transferencia', 'tarjeta', 'mercadopago', 'otro') NOT NULL DEFAULT 'manual',
  estado           ENUM('aprobado', 'pendiente', 'rechazado', 'reintegrado') NOT NULL DEFAULT 'aprobado',
  referencia_externa VARCHAR(120) NULL,
  fecha_pago       DATETIME NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pago),
  INDEX idx_pago_membresia (id_membresia, fecha_pago),
  INDEX idx_pago_estado (estado),
  CONSTRAINT fk_pago_membresia
    FOREIGN KEY (id_membresia) REFERENCES membresias (id_membresia)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Medicos cuyo uso del sistema cubre un gerente
CREATE TABLE IF NOT EXISTS gerente_medico_beneficios (
  id_gerente      INT UNSIGNED NOT NULL,
  id_medico       INT UNSIGNED NOT NULL,
  id_clinica      INT UNSIGNED NOT NULL,
  cubre_membresia TINYINT(1)   NOT NULL DEFAULT 1,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_gerente, id_medico, id_clinica),
  INDEX idx_gmb_medico_activo (id_medico, activo),
  CONSTRAINT fk_gmb_gerente FOREIGN KEY (id_gerente) REFERENCES gerentes (id_gerente) ON DELETE CASCADE,
  CONSTRAINT fk_gmb_medico FOREIGN KEY (id_medico) REFERENCES medicos (id_medico) ON DELETE CASCADE,
  CONSTRAINT fk_gmb_clinica FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica) ON DELETE CASCADE
) ENGINE = InnoDB;
