# Agisad Backend

Backend de Agisad con Node.js + Express + MySQL.

## Requisitos

- Node.js 20+
- MySQL 8+

## Instalacion

1. Configurar base de datos `clinica_db` con el schema MySQL definido para el proyecto.
2. Crear `.env` con las variables requeridas y completar credenciales.
3. Instalar dependencias:

```bash
npm install
```

4. Aplicar migraciones SQL en orden:

```bash
# 1) base
mysql -u <usuario> -p clinica_db < sql/001_schema_base.sql
# 2) mejoras
mysql -u <usuario> -p clinica_db < sql/002_mejoras.sql
# 3) relaciones de negocio (gerentes / clínicas / vínculos pacientes)
mysql -u <usuario> -p clinica_db < sql/003_relaciones_negocio.sql
# 4) admin + finanzas (membresías, pagos, cobertura gerente)
mysql -u <usuario> -p clinica_db < sql/004_admin_finanzas.sql
```

## Comandos

- `npm run dev`: servidor en modo desarrollo con recarga
- `npm run start`: servidor normal
- `npm run check`: valida que la app cargue sin errores
- `npm run seed`: inserta datos demo

## Endpoints

- `GET /` estado base de la API
- `GET /api/health` estado de API + ping DB

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register/paciente`
- `POST /api/auth/register/medico`
- `POST /api/auth/register/gerente`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`

### Medicos

- `GET /api/medicos`
- `GET /api/medicos/:id_medico/disponibilidad?id_clinica=1&fecha=2026-05-23`

### Turnos

- `GET /api/turnos?id_medico=1&desde=2026-05-20&hasta=2026-05-30` (requiere JWT)
- `POST /api/turnos` (requiere JWT)
- `PATCH /api/turnos/:id_turno/estado` (requiere JWT)

### Pacientes

- `GET /api/pacientes?id_medico=1` (requiere JWT medico/asistente/admin)
- `GET /api/pacientes/:id` (requiere JWT)
- `PATCH /api/pacientes/:id` (requiere JWT paciente/admin)

### Asistentes

- `GET /api/asistentes?id_medico=1` (requiere JWT medico/admin)
- `GET /api/asistentes/:id` (requiere JWT)
- `PATCH /api/asistentes/:id/permisos?id_medico=1` (requiere JWT medico/admin)

### Gerente

- `GET /gerente` panel base de gerente

### Admin

- `GET /api/admin/usuarios?q=&rol=&suscripcion=` (requiere JWT admin)
- `GET /api/admin/usuarios/:id_usuario` (requiere JWT admin)
- `GET /api/admin/finanzas` (requiere JWT admin)

## Notas

- Los endpoints protegidos esperan `Authorization: Bearer <token>`.
- Se usa `turnos_historial` en alta y cambios de estado para auditoria.
