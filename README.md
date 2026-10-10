# Agisad - Agenda Integral de Salud

Agisad es una plataforma web para médicos, asistentes y pacientes que centraliza la gestión de turnos, recetas, mensajes y operación diaria de consultorios.

- Frontend: React 19 + Vite (`frontend/`)
- Backend: Node.js + Express 5 + MySQL 8 (`backend/`)
- Producción: frontend en `https://agisad.ar`, API en `https://api.agisad.ar`

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
- Propietario (alquila consultorios a médicos, sin atender pacientes)
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

Al registrarse solo se pueden elegir los planes públicos de cada rol (`PLANES_REGISTRABLES` en `membresias.service.js`): médico → Inicial, Medio, Profesional o Empresarial; gerente → Empresarial; propietario → Espacios. Los registros no crean planes: un código desconocido (o uno interno, como `legacy`) responde 400. Los gerentes se registran desde `/registro/profesional` eligiendo Empresarial.

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
| `npm test` | Corre la suite de tests (Jest) |
| `npm run test:coverage` | Tests con reporte de cobertura |

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
| `RESEND_API_KEY` | API key de Resend (empieza con `re_`) | requerida fuera de `development` |
| `MAIL_FROM` | Remitente por defecto | requerida fuera de `development` |
| `MAIL_FROM_RECETAS` / `MAIL_FROM_TURNOS` | Remitentes de recetas/mensajes y de turnos/consultorios | `MAIL_FROM` |
| `APP_TIMEZONE`, `APP_LOCALE` | Zona horaria y locale | requeridas |

> `TRUST_PROXY` debe estar activo detrás de un proxy (Render, Nginx). Sin eso todas las requests comparten la misma IP y el rate limit se agota de forma global.

> Mails: con `NODE_ENV=development` se imprimen en consola en vez de enviarse. En cualquier otro entorno, si falta `RESEND_API_KEY` o `MAIL_FROM`, el mailer lo avisa al arrancar y cada envío falla con un error explícito (no se pierden en silencio).

### Migraciones

Los scripts viven en `backend/sql/` y se aplican en el orden declarado en `backend/src/scripts/migrate.js`. Cada archivo aplicado queda registrado en la tabla `migration_log`, por lo que `npm run migrate` es idempotente.

Al agregar una migración nueva: crear el `.sql` numerado y sumarlo al array `MIGRATIONS`. El test `tests/unit/scripts/migrate.test.js` verifica que cada migración listada exista, esté en orden y se pueda partir en statements.

> `010_hotfix_clinicas_virtual_link.sql` no está en la lista a propósito: la reemplazó `011`.

### Endpoints

Todas las rutas cuelgan de `/api`. Entre paréntesis, los roles permitidos; "JWT" significa cualquier usuario autenticado. El detalle de parámetros y respuestas de cada una está cubierto por `backend/tests/routes/api.routes.test.js`.

**Base** (públicas)

- `GET /` — estado de la API
- `GET /api/ping`
- `GET /api/health` — estado de la API + ping a la base

**Auth** (`/api/auth`)

- `POST /login` — con rate limit de intentos fallidos
- `GET /me` (JWT)
- `POST /register/paciente` · `/register/medico` · `/register/gerente` · `/register/propietario`
- `POST /forgot-password` · `POST /reset-password/:token`
- `POST /verificar-email` · `POST /verificar-email/reenviar` — con rate limit

**Médicos** (`/api/medicos`)

- Públicas: `GET /` · `GET /:id_medico` · `GET /:id_medico/clinicas` · `GET /:id_medico/disponibilidad?id_clinica=&fecha=&duracion_minutos=` (slots de un día; cada slot trae `libre`, `bloqueado` y `excede_horario`) · `GET /:id_medico/disponibilidad-resumen?id_clinica=&desde=&hasta=&duracion_minutos=` (estado de cada día del rango, máx. 62 días; lo usa el calendario del paciente) · `GET /:id_medico/turnos-config`
- Del médico autenticado (médico): `/me/clinicas` (GET, POST, PATCH/DELETE `/:id_clinica`) · `GET /me/disponibilidad` · `/me/turnos-config` (GET, PUT) · `/me/bloqueos` (GET, POST, PATCH/DELETE `/:id_excepcion`) · `GET /me/recetas-solicitudes` · `PATCH /me/recetas-solicitudes/:id_solicitud/estado` · `/me/mail-config` (GET, PUT) · `/me/tyc` (GET, POST)

**Turnos** (`/api/turnos`)

- `GET /mis` (paciente)
- `GET /?id_medico=&desde=&hasta=` · `GET /historial` (médico, asistente, admin, gerente)
- `POST /` (paciente, asistente, médico, admin)
- `PATCH /:id_turno/cancelar` (paciente)
- `PATCH /:id_turno/estado` (médico, asistente, admin)

**Pacientes** (`/api/pacientes`)

- `GET /?id_medico=&q=` (médico, asistente, admin) · `POST /` alta manual (médico, asistente)
- `GET /me` · `PATCH /me` · `GET /me/recetas` · `GET /me/mensajes` (paciente)
- `GET /obras-sociales` (JWT)
- `POST /medicos/:id_medico/recetas` · `POST /medicos/:id_medico/mensajes` · `GET /medicos/:id_medico/tyc` · `POST /medicos/:id_medico/tyc/aceptar` (paciente)
- `GET /buscar-dni/:dni` (médico, asistente)
- `GET /:id` (paciente, médico, asistente, admin) · `GET /:id/historial` (médico, admin) · `PATCH /:id` (paciente, médico, admin)

**Asistentes** (`/api/asistentes`)

- `GET /me/access` (asistente)
- `POST /` (médico, gerente, admin) — el médico siempre crea asistentes para sí mismo; el gerente, para médicos de sus clínicas
- `GET /` · `GET /:id` · `PATCH /:id/permisos` (médico, admin) — el médico opera sobre sus propios asistentes sin indicar `id_medico`; el admin lo pasa en `?id_medico=`

**Gerentes** (`/api/gerentes`)

- Gerente: `GET /me/clinicas` · `/invitaciones` (GET, POST, DELETE `/:id`) · `GET /medicos` · `DELETE /medicos/:id_medico?id_clinica=`
- `GET /invitaciones/:token` (pública) · `POST /invitaciones/:token/aceptar` (JWT) · `POST /invitaciones/:token/registrar` (pública)

**Consultorios en alquiler** (`/api/consultorios`)

- Públicas: `GET /publicos` · `GET /:id_clinica/disponibilidad-publica?fecha=`
- Dueño (propietario o médico): `GET /mios` · `GET /solicitudes/recibidas` · `PATCH /solicitudes/:id_solicitud/aprobar|rechazar` · `/:id_clinica/disponibilidad` (GET, PUT) · `GET /:id_clinica/medicos` · `DELETE /:id_clinica/medicos/:id_medico` · `GET /:id_clinica/reporte-uso?desde=&hasta=`
- Propietario: `POST /`
- Médico: `PATCH /:id_clinica/publicar` · `/adicional` (GET, POST, DELETE) · `GET /solicitudes/mias` · `POST /:id_clinica/solicitudes`

**Admin** (`/api/admin`, solo admin)

- `GET /usuarios?q=&rol=&suscripcion=` · `GET /usuarios/:id_usuario` · `GET /finanzas` · `POST /membresias/reactivar`

Los endpoints protegidos esperan `Authorization: Bearer <token>`.

### Acceso a los datos de un médico

El rol habilita la ruta; **qué médico** se puede tocar lo decide un único lugar, `modules/acceso/acceso.service.js` (`resolverMedicoAccesible`), que usan turnos y pacientes:

| Rol | Agenda y turnos (lectura) | Agendar / cambiar estado | Pacientes |
|-----|---------------------------|--------------------------|-----------|
| Médico | Solo la propia | Solo la propia | Solo los propios |
| Asistente | Médicos que lo vincularon, con permiso `agenda` (aunque esté bloqueado) | Idem, sin estar bloqueado | Médicos que lo vincularon, sin estar bloqueado |
| Gerente | Médicos que atienden en sus clínicas | — | — |
| Admin | Cualquiera | Cualquiera | Cualquiera |

Además, un turno solo se puede crear:

- en un consultorio donde el médico atiende (`medico_clinicas`);
- en un horario de la grilla que esté libre, no bloqueado y que **termine dentro del horario de atención**. Si el médico atiende hasta las 11:30, un turno de 120 minutos no se puede sacar a las 10:30. Franjas contiguas (9 a 11 y 11 a 13) cuentan como atención continua.

Lo valida `verificarHorarioDisponible()` en `medicos.service.js`, con el mismo cálculo de slots que ve el paciente (`utils/slots.js`). Si el pedido no trae la duración, se usa la del tipo de turno y, si tampoco hay tipo, la estándar del médico. Los rechazos responden 409 con `details.code`: `EXCEDE_HORARIO`, `FUERA_DE_AGENDA`, `HORARIO_BLOQUEADO` o `TURNO_OVERLAP`. Las altas y los cambios de estado de turnos se auditan en `turnos_historial`.

---

## Frontend

React 19 + Vite con `@vitejs/plugin-react`. React Compiler no está habilitado por su impacto en tiempos de dev y build.

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run preview` | Sirve el build |
| `npm run lint` | ESLint |
| `npm test` | Corre la suite de tests (Vitest) |
| `npm run test:watch` | Tests en modo watch |

Estructura principal en `frontend/src/`:

- `pages/` — vistas por rol (`public`, `paciente`, `medico`, `asistente`, `gerente`, `propietario`, `admin`)
- `layouts/` — layout por rol + layout público
- `components/` — `ui`, `forms`, `layout`
- `context/` — `AuthContext`, `ThemeContext` (modo día/noche)
- `services/` — clientes de API sobre `apiClient.js`
- `utils/` — formato de fechas, inputs inteligentes de fecha/hora

Detalle de pantallas y flujos en `docs/wireframes-v1.md` y `docs/estructura-frontend.md` (la carpeta `docs/` está en `.gitignore`: solo existe en copias locales).

---

## Tests

| | Backend | Frontend |
|---|---|---|
| Herramienta | Jest + Supertest | Vitest + Testing Library (jsdom) |
| Ubicación | `backend/tests/` | `frontend/tests/` |
| Comando | `npm test` | `npm test` |

Ninguna suite necesita base de datos, red ni `.env`:

- **Backend.** `tests/setup-env.js` define variables de entorno de prueba y `dotenv` está mockeado, así que nunca se lee el `.env` real ni se mandan mails. Los services se prueban con los repositories mockeados; los repositories con transacciones, con una conexión falsa (`tests/helpers/fakeConnection.js`). `tests/routes/api.routes.test.js` recorre todas las rutas y verifica 401 sin token, 403 con roles no permitidos y los argumentos que cada controller le pasa al service. **Al agregar una ruta, sumarla a la tabla `ROUTES` de ese archivo.**
- **Frontend.** `vite.config.js` fija `VITE_API_BASE` y la zona horaria para los tests, y `tests/setup.js` hace que cualquier `fetch` no mockeado falle. Las páginas se prueban con los `services/*.api.js` mockeados; `tests/helpers/render.jsx` monta router, tema y sesión.

Lo que estos tests **no** cubren es el SQL en sí: para eso hace falta correr los repositories contra un MySQL real (por ejemplo, con Testcontainers en CI).

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
| Dashboard sin datos que requieran plan | `POST /pacientes/medicos/:id_medico/recetas` |
| `PATCH /turnos/:id_turno/estado` (no valida membresía) | `POST /pacientes/medicos/:id_medico/mensajes` |

Los pacientes no tienen membresía: en sus acciones se valida la del médico destinatario.

Un médico invitado por un gerente puede no tener membresía propia: en ese caso `assertMembershipNotExpired()` usa la del gerente que lo cubre (`gerente_medico_beneficios`). Las acciones que exigen membresía **propia** (crear una clínica independiente, publicar un consultorio para alquiler) usan `assertOwnMembershipActive()`, que no acepta esa cobertura.

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
| Acceso por médico | `acceso.service.js` | Ver "Acceso a los datos de un médico" |
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
- [x] Control de acceso por médico (turnos, pacientes, asistentes)
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
validateEmail(email)            // RFC 5322 simplificado, máx. 255
validatePassword(password)      // 8+ chars, al menos una letra y un número
validateDNI(dni)                // 7-8 dígitos
validatePhoneNumber(telefono)   // Normaliza a E.164 (+549…); sin código de país asume Argentina y quita 0 y 15
validateName(nombre, field)     // Letras, espacios, acentos, guiones y apóstrofes, máx. 100
validateTextField(text, max)    // Longitud máxima (opcional u obligatorio)
validateMatricula(matricula)    // Alfanumérica + / - . , máx. 20
validateDate(dateString)        // YYYY-MM-DD y que la fecha exista (rechaza 2024-02-30)
```

Los campos de texto libre (`validateTextField`) no filtran caracteres: solo validan largo. La salida al navegador la escapa React.

El frontend aplica la misma regla de contraseña antes de enviar (`frontend/src/utils/password.js`): si cambia una, tiene que cambiar la otra.

### Cobertura

| Campo | Módulo | Validación | Máximo | Requerido |
|-------|--------|-----------|--------|-----------|
| `email` | auth | Formato RFC 5322 | 255 | Sí |
| `password` | auth | 8+ chars, letra + número | 255 | Sí |
| `nombre` / `apellido` | auth, pacientes, medicos, gerentes | Alfanumérico + espacios | 100 | Sí |
| `dni` | pacientes, medicos | 7-8 dígitos | 8 | Sí |
| `matricula` | medicos | Alfanumérica + `/ - .` | 20 | Sí |
| `telefono` | pacientes, medicos, gerentes | Normalizado a E.164 (8 a 15 dígitos) | 25 | No |
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

Documentación adicional (solo en copias locales: `docs/` no se versiona):

- `docs/wireframes-v1.md` — especificación de pantallas y flujos
- `docs/estructura-frontend.md` — estructura del frontend
- `docs/sql/recomendaciones_flujo.md` — recomendaciones de flujo de datos

Licencia: ver [LICENSE](LICENSE).
