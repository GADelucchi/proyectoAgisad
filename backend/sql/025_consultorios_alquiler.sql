-- Consultorios en alquiler: rol "propietario" (dueño de inmueble sin práctica
-- médica) y consultorios compartidos, donde la disponibilidad y el chequeo de
-- solapamiento pasan a ser a nivel consultorio en vez de por médico.

INSERT IGNORE INTO roles (nombre) VALUES ('propietario');

CREATE TABLE IF NOT EXISTS propietarios (
  id_propietario INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED NOT NULL,
  nombre         VARCHAR(80)  NOT NULL,
  apellido       VARCHAR(80)  NOT NULL,
  telefono       VARCHAR(30)  NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_propietario),
  UNIQUE KEY uq_prop_usuario (id_usuario),
  CONSTRAINT fk_prop_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Un consultorio pertenece a un unico propietario (mismo criterio que gerente_clinicas).
CREATE TABLE IF NOT EXISTS propietario_clinicas (
  id_propietario INT UNSIGNED NOT NULL,
  id_clinica     INT UNSIGNED NOT NULL,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_propietario, id_clinica),
  UNIQUE KEY uq_pc_clinica_unica (id_clinica),
  CONSTRAINT fk_pc_propietario
    FOREIGN KEY (id_propietario) REFERENCES propietarios (id_propietario)
    ON DELETE CASCADE,
  CONSTRAINT fk_pc_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- Distingue al medico dueño del consultorio del medico inquilino vinculado por
-- solicitud. Default 1 porque toda fila existente hoy es de un dueño.
ALTER TABLE medico_clinicas
  ADD COLUMN es_propietario TINYINT(1) NOT NULL DEFAULT 1;

-- compartido=1 activa disponibilidad y chequeo de solapamiento a nivel consultorio.
ALTER TABLE clinicas
  ADD COLUMN compartido TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE membresia_planes
  ADD COLUMN permite_publicar_consultorio TINYINT(1) NOT NULL DEFAULT 0;

UPDATE membresia_planes
SET permite_publicar_consultorio = 1
WHERE codigo IN ('profesional', 'empresarial');

INSERT INTO membresia_planes (
  codigo, nombre, descripcion, activo, vigencia_meses, precio_mensual,
  permite_turnos, permite_asistentes, limite_asistentes, permite_publicar_consultorio
) VALUES (
  'espacios', 'Espacios', 'Para propietarios que alquilan consultorios sin atender pacientes.',
  1, 1, NULL, 0, 0, 0, 1
) ON DUPLICATE KEY UPDATE permite_publicar_consultorio = 1;

CREATE TABLE IF NOT EXISTS consultorio_disponibilidad (
  id_disponibilidad INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_clinica        INT UNSIGNED      NOT NULL,
  dia_semana        TINYINT UNSIGNED  NOT NULL,
  hora_inicio       TIME              NOT NULL,
  hora_fin          TIME              NOT NULL,
  duracion_turno    SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  activo            TINYINT(1)        NOT NULL DEFAULT 1,
  PRIMARY KEY (id_disponibilidad),
  INDEX idx_cd_clinica_dia (id_clinica, dia_semana, activo),
  CONSTRAINT fk_cd_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS consultorio_disponibilidad_excepciones (
  id_excepcion INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_clinica   INT UNSIGNED NOT NULL,
  fecha        DATE         NOT NULL,
  hora_inicio  TIME         NULL,
  hora_fin     TIME         NULL,
  tipo         ENUM('bloqueo', 'extra') NOT NULL,
  motivo       VARCHAR(255) NULL,
  PRIMARY KEY (id_excepcion),
  INDEX idx_cde_clinica_fecha (id_clinica, fecha),
  CONSTRAINT fk_cde_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS consultorio_solicitudes (
  id_solicitud   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_clinica     INT UNSIGNED NOT NULL,
  id_medico      INT UNSIGNED NOT NULL,
  estado         ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  mensaje        VARCHAR(500) NULL,
  motivo_rechazo VARCHAR(255) NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resuelta_en    DATETIME     NULL,
  PRIMARY KEY (id_solicitud),
  INDEX idx_cs_clinica_estado (id_clinica, estado),
  INDEX idx_cs_medico (id_medico, estado),
  CONSTRAINT fk_cs_clinica
    FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica)
    ON DELETE CASCADE,
  CONSTRAINT fk_cs_medico
    FOREIGN KEY (id_medico) REFERENCES medicos (id_medico)
    ON DELETE CASCADE
) ENGINE = InnoDB;
