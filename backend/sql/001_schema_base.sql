-- ============================================================
--  Agisad – Schema base v1
--  Ejecutar ANTES de 002_mejoras.sql
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- --------------------------------------------------------
-- Catálogos
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id_rol    TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(30)      NOT NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uq_rol_nombre (nombre)
) ENGINE = InnoDB;

INSERT IGNORE INTO roles (nombre) VALUES ('admin'), ('medico'), ('paciente'), ('asistente');

CREATE TABLE IF NOT EXISTS provincias (
  id_provincia  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(80)       NOT NULL,
  PRIMARY KEY (id_provincia),
  UNIQUE KEY uq_provincia_nombre (nombre)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS ciudades (
  id_ciudad    SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_provincia SMALLINT UNSIGNED NOT NULL,
  nombre       VARCHAR(80)       NOT NULL,
  PRIMARY KEY (id_ciudad),
  CONSTRAINT fk_ciudad_provincia
    FOREIGN KEY (id_provincia) REFERENCES provincias (id_provincia)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS especialidades (
  id_especialidad SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre          VARCHAR(100)      NOT NULL,
  PRIMARY KEY (id_especialidad),
  UNIQUE KEY uq_especialidad_nombre (nombre)
) ENGINE = InnoDB;

INSERT IGNORE INTO especialidades (nombre)
VALUES
  ('Clínica Médica'),
  ('Pediatría'),
  ('Cardiología'),
  ('Dermatología'),
  ('Ginecología'),
  ('Traumatología'),
  ('Neurología'),
  ('Oftalmología'),
  ('Psiquiatría'),
  ('Psicología'),
  ('Kinesiología'),
  ('Nutrición');

CREATE TABLE IF NOT EXISTS obras_sociales (
  id_obra_social SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre         VARCHAR(120)      NOT NULL,
  PRIMARY KEY (id_obra_social),
  UNIQUE KEY uq_os_nombre (nombre)
) ENGINE = InnoDB;

INSERT IGNORE INTO obras_sociales (nombre)
VALUES
  ('OSDE'),
  ('Swiss Medical'),
  ('IOMA'),
  ('PAMI'),
  ('Galeno'),
  ('Medicus');

-- --------------------------------------------------------
-- Usuarios (tabla base de autenticación)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_rol            TINYINT UNSIGNED NOT NULL,
  username          VARCHAR(50)   NOT NULL,
  email             VARCHAR(150)  NOT NULL,
  password_hash     VARCHAR(255)  NOT NULL,
  email_verificado  TINYINT(1)    NOT NULL DEFAULT 0,
  activo            TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_username (username),
  UNIQUE KEY uq_usuario_email    (email),
  CONSTRAINT fk_usuario_rol
    FOREIGN KEY (id_rol) REFERENCES roles (id_rol)
) ENGINE = InnoDB;

-- --------------------------------------------------------
-- Pacientes
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS pacientes (
  id_paciente      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_usuario       INT UNSIGNED     NOT NULL,
  dni              VARCHAR(12)      NOT NULL,
  nombre           VARCHAR(80)      NOT NULL,
  apellido         VARCHAR(80)      NOT NULL,
  telefono         VARCHAR(25)      NULL,
  fecha_nac        DATE             NULL,
  id_obra_social   SMALLINT UNSIGNED NULL,
  nro_obra_social  VARCHAR(30)      NULL,
  acepta_tyc       TINYINT(1)       NOT NULL DEFAULT 0,
  acepta_tyc_fecha DATETIME         NULL,
  PRIMARY KEY (id_paciente),
  UNIQUE KEY uq_paciente_usuario (id_usuario),
  UNIQUE KEY uq_paciente_dni     (dni),
  CONSTRAINT fk_paciente_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE,
  CONSTRAINT fk_paciente_os
    FOREIGN KEY (id_obra_social) REFERENCES obras_sociales (id_obra_social)
) ENGINE = InnoDB;

-- --------------------------------------------------------
-- Médicos
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinicas (
  id_clinica    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(150)     NOT NULL,
  id_ciudad     SMALLINT UNSIGNED NOT NULL,
  direccion     VARCHAR(255)     NULL,
  telefono      VARCHAR(25)      NULL,
  activo        TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_clinica),
  CONSTRAINT fk_clinica_ciudad
    FOREIGN KEY (id_ciudad) REFERENCES ciudades (id_ciudad)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS medicos (
  id_medico         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_usuario        INT UNSIGNED     NOT NULL,
  id_especialidad   SMALLINT UNSIGNED NOT NULL,
  id_ciudad         SMALLINT UNSIGNED NULL,
  matricula         VARCHAR(30)      NOT NULL,
  nombre            VARCHAR(80)      NOT NULL,
  apellido          VARCHAR(80)      NOT NULL,
  telefono          VARCHAR(25)      NULL,
  bio               TEXT             NULL,
  foto_url          VARCHAR(500)     NULL,
  acepta_tyc        TINYINT(1)       NOT NULL DEFAULT 0,
  acepta_tyc_fecha  DATETIME         NULL,
  activo            TINYINT(1)       NOT NULL DEFAULT 1,
  creado_en         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_medico),
  UNIQUE KEY uq_medico_usuario   (id_usuario),
  UNIQUE KEY uq_medico_matricula (matricula),
  CONSTRAINT fk_medico_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE,
  CONSTRAINT fk_medico_especialidad
    FOREIGN KEY (id_especialidad) REFERENCES especialidades (id_especialidad),
  CONSTRAINT fk_medico_ciudad
    FOREIGN KEY (id_ciudad) REFERENCES ciudades (id_ciudad)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS medico_clinicas (
  id_medico_clinica INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico         INT UNSIGNED NOT NULL,
  id_clinica        INT UNSIGNED NOT NULL,
  activo            TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id_medico_clinica),
  UNIQUE KEY uq_mc (id_medico, id_clinica),
  CONSTRAINT fk_mc_medico  FOREIGN KEY (id_medico)  REFERENCES medicos  (id_medico)  ON DELETE CASCADE,
  CONSTRAINT fk_mc_clinica FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS medico_disponibilidad (
  id_disponibilidad INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico         INT UNSIGNED NOT NULL,
  id_clinica        INT UNSIGNED NOT NULL,
  dia_semana        TINYINT UNSIGNED NOT NULL COMMENT '0=domingo … 6=sabado',
  hora_inicio       TIME         NOT NULL,
  hora_fin          TIME         NOT NULL,
  duracion_turno    SMALLINT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'minutos',
  activo            TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_disponibilidad),
  CONSTRAINT fk_disp_medico  FOREIGN KEY (id_medico)  REFERENCES medicos  (id_medico)  ON DELETE CASCADE,
  CONSTRAINT fk_disp_clinica FOREIGN KEY (id_clinica) REFERENCES clinicas (id_clinica) ON DELETE CASCADE
) ENGINE = InnoDB;

-- --------------------------------------------------------
-- Asistentes
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS asistentes (
  id_asistente  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario    INT UNSIGNED NOT NULL,
  nombre        VARCHAR(80)  NOT NULL,
  apellido      VARCHAR(80)  NOT NULL,
  telefono      VARCHAR(25)  NULL,
  activo        TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_asistente),
  UNIQUE KEY uq_asistente_usuario (id_usuario),
  CONSTRAINT fk_asistente_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    ON DELETE CASCADE
) ENGINE = InnoDB;

-- --------------------------------------------------------
-- Turnos
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS turnos (
  id_turno      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_medico     INT UNSIGNED NOT NULL,
  id_clinica    INT UNSIGNED NOT NULL,
  id_paciente   INT UNSIGNED NOT NULL,
  fecha         DATE         NOT NULL,
  hora_inicio   TIME         NOT NULL,
  hora_fin      TIME         NOT NULL,
  estado        ENUM('pendiente', 'confirmado', 'cancelado', 'ausente', 'realizado') NOT NULL DEFAULT 'pendiente',
  motivo        VARCHAR(255) NULL,
  observaciones TEXT         NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_turno),
  CONSTRAINT fk_turno_medico   FOREIGN KEY (id_medico)   REFERENCES medicos   (id_medico)   ON DELETE RESTRICT,
  CONSTRAINT fk_turno_clinica  FOREIGN KEY (id_clinica)  REFERENCES clinicas  (id_clinica)  ON DELETE RESTRICT,
  CONSTRAINT fk_turno_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE RESTRICT
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS turnos_historial (
  id_historial  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_turno      INT UNSIGNED NOT NULL,
  estado_previo ENUM('pendiente', 'confirmado', 'cancelado', 'ausente', 'realizado') NULL,
  estado_nuevo  ENUM('pendiente', 'confirmado', 'cancelado', 'ausente', 'realizado') NOT NULL,
  id_usuario    INT UNSIGNED NULL COMMENT 'Quién hizo el cambio',
  motivo        VARCHAR(255) NULL,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_historial),
  CONSTRAINT fk_hist_turno   FOREIGN KEY (id_turno)   REFERENCES turnos   (id_turno)   ON DELETE CASCADE,
  CONSTRAINT fk_hist_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL
) ENGINE = InnoDB;
