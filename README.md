# Agisad - Agenda Integral de Salud

Agisad es una plataforma web para médicos, asistentes y pacientes que centraliza la gestión de turnos, recetas, mensajes y operación diaria de consultorios.

- Frontend: React 19 + Vite (`frontend/`)
- Backend: Node.js + Express 5 + MySQL 8 (`backend/`)
- Producción: frontend en `https://sigem.ar`, API en `https://api.sigem.ar`

## Índice

1. [Producto](#producto)
2. [Planes de suscripción](#planes-de-suscripción)
3. [Puesta en marcha](#puesta-en-marcha)
4. [Backend](#backend)
5. [Frontend](#frontend)
6. [Período de prueba y control de acceso](#período-de-prueba-y-control-de-acceso)
7. [Seguridad](#seguridad)
8. [Validación de inputs](#validación-de-inputs)
9. [Estado del proyecto](#estado-del-proyecto)

---

## Producto

### Propuesta de valor

- Pacientes autogestionan acciones clave: solicitar receta, pedir turno, cancelar turno y enviar consultas.
- Médicos administran agenda, consultorios, bloqueos, pacientes, historial y asistentes desde un solo panel.
- Asistentes trabajan con permisos configurables por médico.
- Modelo SaaS por suscripción mensual con funciones y límites por plan.

### Roles

- Paciente
- Médico
- Asistente / Secretaría
- Gerente (clínica)
- Admin de plataforma (operación comercial y alta de médicos)

### Alcance V1

- Landing pública con presentación del producto.
- Autenticación unificada (paciente, médico, asistente, gerente, admin).
- Registro de paciente con validación de email.
- Panel paciente: buscador de médico/centro, acciones según plan activo del médico.
- Flujo de turnos: consultorio → tipo de consulta → fecha → horario → confirmación.
- Flujo de recetas: formulario estructurado (medicamento + dosis/cantidad).
- Panel médico con pestañas: Agenda, Configuración, Pacientes, Historial.
- Panel asistente con los mismos módulos, respetando permisos.
- Centro de notificaciones configurable por médico.
- Aceptación de T&C por médico, registrada por paciente en primera acción.

### Decisiones técnicas confirmadas

- Una sola app web con control de roles.
- MySQL en V1; migración posible a PostgreSQL para analítica.
- Confirmación de turno sin pago en V1 (el médico confirma manualmente).
- Lista de espera por orden de llegada estricto.
- Registro de paciente con validación de email obligatoria.
- Alta de médico manual por admin de la plataforma.
- El buscador muestra solo médicos/clínicas con suscripción activa.
- Modo día y modo noche desde V1.
- Vista semanal de agenda incluida en V1.

---

## Planes de suscripción

| Plan | Incluye |
|------|---------|
| **Básico** | Solicitud de receta (estándar 7 días / urgente 24 h) y envío al mail del médico |
| **Intermedio** | Básico + autogestión de turnos, recordatorios por email, hasta 4 consultorios, hasta 1 asistente |
| **Profesional** | Intermedio + reportes y métricas, auditoría avanzada, centro de notificaciones configurable, soporte prioritario, hasta 3 asistentes |
| **Empresarial** | Profesional + multi-médico, multi-asistentes sin límite fijo, permisos por sede, integraciones y API, pasarela de pago configurable |

---

## Puesta en marcha

Requisitos: Node.js 20+ y MySQL 8+.

### Backend

```bash
cd backend
npm install
# crear .env con las variables de la tabla de abajo
npm run migrate        # aplica las migraciones pendientes en orden
npm run seed           # opcional: datos demo
npm run dev            # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

El frontend requiere `VITE_API_BASE` apuntando a la API (`http://localhost:4000/api` en local).

---

## Backend

### Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor con recarga (nodemon) |
| `npm start` | Servidor normal |
| `npm run check` | Valida que la app cargue sin errores |
| `npm run migrate` | Aplica migraciones SQL pendientes (registra en `migration_log`) |
| `npm run seed` | Inserta datos demo |

### Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | — |
| `PORT` | Puerto del servidor | `4000` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexión MySQL | requeridas |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` | TLS hacia la base | `false` / `true` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y expiración del token | requeridas |
| `FRONTEND_URL` | URL pública del frontend | requerida |
| `CORS_ALLOWED_ORIGINS` | Orígenes permitidos, separados por coma | requerida |
| `TRUST_PROXY` | Confianza en el proxy reverso | `1` en producción, `false` fuera |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limit global | `900000` / `600` |
| `LOGIN_RATE_LIMIT_WINDOW_MS` / `LOGIN_RATE_LIMIT_MAX` | Rate limit de login fallido | `600000` / `10` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP para notificaciones | opcionales |
| `APP_TIMEZONE`, `APP_LOCALE` | Zona horaria y locale | requeridas |

> `TRUST_PROXY` debe estar activo detrás de un proxy (Render, Nginx). Sin eso todas las requests comparten la misma IP y el rate limit se agota de forma global.

### Migraciones

Los scripts viven en `backend/sql/` y se aplican en el orden declarado en `backend/src/scripts/migrate.js`. Cada archivo aplicado queda registrado en la tabla `migration_log`, por lo que `npm run migrate` es idempotente.

Al agregar una migración nueva: crear el `.sql` numerado y sumarlo al array `MIGRATIONS`.

### Endpoints

**Base**

- `GET /` — estado de la API
- `GET /api/health` — estado de API + ping a la base

**Auth**

- `POST /api/auth/login`
- `POST /api/auth/register/paciente`
- `POST /api/auth/register/medico`
- `POST /api/auth/register/gerente`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`

**Médicos**

- `GET /api/medicos`
- `GET /api/medicos/:id_medico/disponibilidad?id_clinica=1&fecha=2026-05-23`

**Turnos** (requieren JWT)

- `GET /api/turnos?id_medico=1&desde=2026-05-20&hasta=2026-05-30`
- `POST /api/turnos`
- `PATCH /api/turnos/:id_turno/estado`

**Pacientes** (requieren JWT)

- `GET /api/pacientes?id_medico=1` — médico / asistente / admin
- `GET /api/pacientes/:id`
- `PATCH /api/pacientes/:id` — paciente / admin

**Asistentes** (requieren JWT)

- `GET /api/asistentes?id_medico=1` — médico / admin
- `GET /api/asistentes/:id`
- `PATCH /api/asistentes/:id/permisos?id_medico=1` — médico / admin

**Admin** (requieren JWT admin)

- `GET /api/admin/usuarios?q=&rol=&suscripcion=`
- `GET /api/admin/usuarios/:id_usuario`
- `GET /api/admin/finanzas`

Los endpoints protegidos esperan `Authorization: Bearer <token>`. Las altas y los cambios de estado de turnos se auditan en `turnos_historial`.

---

## Frontend

React 19 + Vite con `@vitejs/plugin-react`. React Compiler no está habilitado por su impacto en tiempos de dev y build.

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build |
| `npm run lint` | ESLint |

Estructura principal en `frontend/src/`:

- `pages/` — vistas por rol (`public`, `paciente`, `medico`, `asistente`, `gerente`, `admin`)
- `layouts/` — layout por rol + layout público
- `components/` — `ui`, `forms`, `layout`
- `context/` — `AuthContext`, `ThemeContext` (modo día/noche)
- `services/` — clientes de API sobre `apiClient.js`
- `utils/` — formato de fechas, inputs inteligentes de fecha/hora

Detalle de pantallas y flujos en [docs/wireframes-v1.md](docs/wireframes-v1.md) y [docs/estructura-frontend.md](docs/estructura-frontend.md).

---

## Período de prueba y control de acceso

Médicos y gerentes obtienen **30 días de prueba gratuita** al registrarse, con todas las funciones del plan elegido.

### Modelo de datos

`backend/sql/016_trial_period.sql` agrega a `membresias`:

```sql
fecha_inicio_trial DATE NULL,
fecha_fin_trial    DATE NULL,
es_trial           TINYINT(1) NOT NULL DEFAULT 0
```

Al registrarse la membresía se crea con `es_trial = 1`, `fecha_inicio_trial = CURDATE()` y `fecha_fin_trial = pagado_hasta = CURDATE() + 30 días`.

### Vigencia

`activa_vigente` se resuelve en SQL:

```sql
CASE
  WHEN m.es_trial = 1 AND (m.fecha_fin_trial IS NULL OR m.fecha_fin_trial >= CURDATE()) THEN 1
  WHEN m.es_trial = 0 AND (m.pagado_hasta   IS NULL OR m.pagado_hasta   >= CURDATE()) THEN 1
  ELSE 0
END
```

### Comportamiento con membresía vencida

El login **no se bloquea**: se permite entrar y el payload devuelve `membresia.membresia_vencida: true` para que el frontend muestre el aviso de renovación.

```json
{
  "token": "jwt...",
  "user": {
    "idUsuario": 123,
    "rol": "medico",
    "membresia": {
      "membresia_vencida": true,
      "es_trial": false,
      "pagado_hasta": "2026-08-10"
    }
  }
}
```

Las acciones que dependen de la membresía responden **HTTP 402 Payment Required** mediante `assertMembershipNotExpired()` / `assertMembershipNotExpiredByMedicoId()` en `membresias.service.js`.

| Permitido | Bloqueado (402) |
|-----------|-----------------|
| Login | `POST /turnos` (agendar) |
| Ver y editar perfil propio | `GET /turnos` e historial cuando el requester es el médico |
| Dashboard sin datos que requieran plan | `PATCH /turnos/:id_turno/estado` |
| | `POST /pacientes/medicos/:id_medico/recetas` |
| | `POST /pacientes/medicos/:id_medico/mensajes` |

Los pacientes no tienen membresía: en sus acciones se valida la del médico destinatario.

---

## Seguridad

### Implementado

| Medida | Dónde | Detalle |
|--------|-------|---------|
| Helmet.js | `app.js` | Headers contra XSS, clickjacking y MIME sniffing |
| CORS whitelist | `app.js` | Orígenes desde `CORS_ALLOWED_ORIGINS`, con `credentials` |
| Rate limiting global | `app.js` | Configurable; excluye `GET /` y preflight `OPTIONS`; se aplica después de CORS para que el 429 sea legible por el navegador |
| Rate limiting de login | `rateLimit.middleware.js` | Solo cuenta intentos fallidos (`skipSuccessfulRequests`) |
| HTTPS enforcement | `app.js` | Redirect 301 en producción según `x-forwarded-proto` |
| Límite de payload | `app.js` | `1mb` en JSON y urlencoded |
| SQL Injection | `db/query.js` | `mysql2/promise` con named placeholders, sin concatenación |
| Autenticación | `auth.middleware.js` | JWT con expiración, `requireAuth` + `requireRoles` |
| Hash de contraseñas | `auth.service.js` | bcrypt |
| TLS a la base | `db/pool.js` | `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` |
| Validación de inputs | `utils/validators.js` | Ver sección siguiente |

CSRF no requiere tokens: al enviarse el JWT en el header `Authorization`, una request cross-site desde un `<form>` no puede adjuntarlo.

Los errores devuelven mensajes genéricos donde corresponde (por ejemplo, "Credenciales inválidas" no revela si el email existe).

### Pendiente

- Logging estructurado de seguridad (accesos no autorizados, cambios críticos).
- Encriptación en reposo de datos sensibles (DNI, teléfono).
- Versionado de API (`/v1`, `/v2`).
- API keys para clientes no-SPA (app móvil, webhooks).

### Checklist

- [x] SQL Injection protegido (prepared statements)
- [x] Autenticación JWT
- [x] Control de acceso por rol
- [x] CORS configurado
- [x] Hash de contraseñas (bcrypt)
- [x] Rate limiting global + login
- [x] Helmet.js
- [x] HTTPS enforcement
- [x] Validación de inputs
- [ ] Logging de seguridad
- [ ] Encriptación de campos sensibles
- [ ] Versionado de API

---

## Validación de inputs

Módulo reutilizable en `backend/src/utils/validators.js`, aplicado en cada service (validación granular con mensajes específicos).

```javascript
validateEmail(email)            // RFC 5322, máx. 255
validatePassword(password)      // 8+ chars, al menos una letra y un número
validateDNI(dni)                // 7-8 dígitos
validatePhoneNumber(telefono)   // 10-20 chars, dígitos y guiones
validateName(nombre, field)     // Alfanumérico + espacios/acentos, máx. 100
validateTextField(text, max)    // Longitud máxima
validateMatricula(matricula)    // Alfanumérica, máx. 20
validateDate(dateString)        // YYYY-MM-DD
validateUsername(username)      // Alfanumérico + `_`, máx. 50
sanitizeHTML(text)              // Escapa < > & " '
```

Los caracteres `<` y `>` se rechazan en campos de texto libre.

### Cobertura

| Campo | Módulo | Validación | Máximo | Requerido |
|-------|--------|-----------|--------|-----------|
| `email` | auth | Formato RFC 5322 | 255 | Sí |
| `password` | auth | 8+ chars, letra + número | 255 | Sí |
| `nombre` / `apellido` | auth, pacientes, medicos, gerentes | Alfanumérico + espacios | 100 | Sí |
| `dni` | pacientes, medicos | 7-8 dígitos | 8 | Sí |
| `matricula` | medicos | Alfanumérica + `/ - .` | 20 | Sí |
| `telefono` | pacientes, medicos, gerentes | Dígitos y guiones | 20 | No |
| `bio` | medicos | Texto libre | 500 | No |
| `clinica_nombre` | gerentes | Texto libre | 100 | Sí |
| `direccion` | gerentes | Texto libre | 200 | Sí |
| `motivo_consulta` | turnos | Texto libre | 500 | No |
| `medicamento` | pacientes | Texto libre | 100 | Sí |
| `dosis` | pacientes | Texto libre | 50 | No |
| `asunto` | pacientes | Texto libre | 150 | Sí |
| `mensaje` | pacientes | Texto libre | 2000 | Sí |

### Mensajes de error

Se devuelven mensajes específicos (HTTP 400) para que el usuario pueda corregir:

```
validateEmail("usuario")        → "El email no tiene un formato válido"
validatePassword("123")         → "La contraseña debe tener al menos 8 caracteres"
validateDNI("abc")              → "El DNI debe tener 7 u 8 dígitos"
validateName("Juan<script>")    → "El nombre contiene caracteres no válidos"
```

### Capas de seguridad

```
1. Express middleware   → helmet · cors · rateLimit · límite de payload
2. Validación de inputs → validators.js + mensajes descriptivos
3. Base de datos        → prepared statements (mysql2/promise)
4. Autenticación        → JWT · control por rol · bcrypt
```

---

## Estado del proyecto

Arquitectura y wireframes V1 definidos. Backend y frontend en construcción sobre la base descrita arriba.

Documentación adicional:

- [docs/wireframes-v1.md](docs/wireframes-v1.md) — especificación de pantallas y flujos
- [docs/estructura-frontend.md](docs/estructura-frontend.md) — estructura del frontend
- [docs/sql/recomendaciones_flujo.md](docs/sql/recomendaciones_flujo.md) — recomendaciones de flujo de datos

Licencia: ver [LICENSE](LICENSE).
