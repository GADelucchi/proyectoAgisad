# Implementación: 30 Días de Prueba + Control de Acceso

## 📋 Resumen de cambios

**FASE 1**: Se implementó un sistema de **30 días de prueba gratuita** para médicos y gerentes.  
**FASE 2**: Después del trial, se **permite login pero se bloquean acciones específicas** (turnos, recetas, mensajes).

---

## 🗄️ Cambios en Base de Datos

### Archivo: `backend/sql/016_trial_period.sql` (NUEVA)

Se agregaron 3 campos a la tabla `membresias`:

```sql
ALTER TABLE membresias
  ADD COLUMN fecha_inicio_trial DATE NULL,
  ADD COLUMN fecha_fin_trial DATE NULL,
  ADD COLUMN es_trial TINYINT(1) NOT NULL DEFAULT 0;
```

- **es_trial**: Bandera que indica si está en período de prueba (1=sí, 0=no)
- **fecha_inicio_trial**: Cuándo comienza el trial
- **fecha_fin_trial**: Cuándo termina (hoy + 30 días)

---

## 🔧 Cambios en Backend - FASE 1

### 1. Creación de membresía con trial (auth.service.js)

**Función modificada**: `createMembershipForUser()`

Ahora se crea con 30 días de trial:
```javascript
fecha_fin: DATE_ADD(CURDATE(), INTERVAL 30 DAY)
pagado_hasta: DATE_ADD(CURDATE(), INTERVAL 30 DAY)
fecha_inicio_trial: CURDATE()
fecha_fin_trial: DATE_ADD(CURDATE(), INTERVAL 30 DAY)
es_trial: 1
```

### 2. Lógica de validación (membresias.service.js y auth.repository.js)

La lógica `activa_vigente` ahora diferencia:
- **Trial activo**: `es_trial=1 AND fecha_fin_trial >= hoy` → ✅ Permitido
- **Plan pagado**: `es_trial=0 AND pagado_hasta >= hoy` → ✅ Permitido  
- **Vencido**: Ambos fallan → ❌ Bloqueado

---

## 🔧 Cambios en Backend - FASE 2

### 1. Cambio en estrategia de login (auth.service.js)

**Antes**: Se bloqueaba completamente login si membresía estaba vencida (HTTP 402)

**Ahora**: 
- ✅ Se **permite login** incluso con membresía vencida
- ❌ Se retorna flag `membresia_vencida: true` en payload
- Frontend puede mostrar aviso/banner

```javascript
{
  token: "jwt...",
  user: {
    idUsuario: 123,
    rol: "medico",
    membresia: {
      membresia_vencida: true,  // ← Flag nuevo
      es_trial: false,
      pagado_hasta: "2026-08-10"
    }
  }
}
```

### 2. Validaciones en acciones específicas (membresias.service.js)

Se agregaron 2 nuevas funciones:

```javascript
// Valida membresía activa del usuario
async function assertMembershipNotExpired(idUsuario, actionMessage)

// Valida membresía activa del médico (por id_medico)
async function assertMembershipNotExpiredByMedicoId(idMedico, actionMessage)
```

Ambas lanzan **HTTP 402** si la membresía está vencida:
```
402 Payment Required
"No es posible agendar turnos porque tu membresía está vencida. Renová tu suscripción para continuar."
```

### 3. Endpoints bloqueados - Turnos (turnos.service.js)

```javascript
crearTurno()              // POST /turnos
  ↓ Valida membresía del médico

listarPorMedico()         // GET /turnos/?desde=...&hasta=...
  ↓ Si requester es médico, valida su membresía

listarHistorialPorMedico() // GET /turnos/historial?desde=...&hasta=...
  ↓ Si requester es médico, valida su membresía
```

### 4. Endpoints bloqueados - Pacientes (pacientes.service.js)

```javascript
solicitarReceta()         // POST /pacientes/medicos/:id_medico/recetas
  ↓ Valida membresía del médico destinatario

solicitarMensaje()        // POST /pacientes/medicos/:id_medico/mensajes
  ↓ Valida membresía del médico destinatario
```

---

## 🔄 Flujo de usuario con membresía vencida

### Escenario: Doctor García tiene membresía vencida

**Paso 1**: Doctor García intenta login
```
POST /auth/login
→ 200 OK
→ membresia_vencida: true
```

**Paso 2**: Frontend muestra aviso
```
"⚠️ Tu membresía está vencida desde 2026-08-10.
 Renová tu plan para continuar usando todas las funciones."
```

**Paso 3**: Doctor García intenta ver sus turnos
```
GET /turnos/?desde=2026-08-15&hasta=2026-08-20
→ 402 Payment Required
→ "No es posible ver los turnos porque tu membresía está vencida..."
```

**Paso 4**: Paciente de Dr. García intenta sacar turno
```
POST /turnos
{
  id_medico: 5,
  fecha: "2026-08-20",
  hora: "10:00"
}
→ 402 Payment Required
→ "No es posible agendar turnos porque la membresía está vencida..."
```

**Paso 5**: Paciente intenta solicitar receta
```
POST /pacientes/medicos/5/recetas
→ 402 Payment Required
→ "No es posible solicitar recetas porque la membresía está vencida..."
```

**Paso 6**: Paciente intenta dejar mensaje
```
POST /pacientes/medicos/5/mensajes
→ 402 Payment Required
→ "No es posible enviar mensajes porque la membresía está vencida..."
```

---

## ✅ Acciones permitidas con membresía vencida

- ✅ Login
- ✅ Ver perfil propio
- ✅ Editar perfil
- ✅ Ver dashboard (sin datos sensibles que requieran membresía)
- ✅ Cualquier otra acción que NO valide membresía

---

## ❌ Acciones BLOQUEADAS con membresía vencida

**Para médicos**:
- ❌ Ver turnos pendientes
- ❌ Ver historial de turnos
- ❌ Cambiar estado de turnos (confirmados, completados, etc.)
- ❌ Acceder a funciones que requieran plan activo

**Para pacientes (con médicos vencidos)**:
- ❌ Agendar turnos
- ❌ Solicitar recetas
- ❌ Dejar mensajes

---

## 🧪 Testing

### Test 1: Verificar trial se crea correctamente
```bash
# 1. Registrar nuevo médico
POST /auth/register/medico
{
  email: "dr@test.com",
  password: "Test123456",
  plan: "medio",
  ...
}

# 2. Verificar en DB
SELECT es_trial, fecha_inicio_trial, fecha_fin_trial 
FROM membresias 
WHERE id_usuario = 1;

# Resultado esperado: es_trial=1, fecha_inicio_trial=hoy, fecha_fin_trial=hoy+30
```

### Test 2: Permitir login con membresía vencida
```bash
# 1. Cambiar fecha en DB para simular vencimiento
UPDATE membresias 
SET fecha_fin_trial = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
WHERE id_usuario = 1;

# 2. Intentar login
POST /auth/login
→ 200 OK
→ membresia_vencida: true

# 3. Intentar crear turno
POST /turnos
→ 402 Payment Required
```

### Test 3: Bloquear recetas y mensajes
```bash
# Intenta solicitar receta
POST /pacientes/medicos/1/recetas
→ 402 Payment Required

# Intenta dejar mensaje
POST /pacientes/medicos/1/mensajes
→ 402 Payment Required
```

---

## 📝 Archivos modificados

- ✅ `backend/sql/016_trial_period.sql` (NUEVA)
- ✅ `backend/src/modules/auth/auth.service.js`
- ✅ `backend/src/modules/auth/auth.repository.js`
- ✅ `backend/src/modules/membresias/membresias.service.js`
- ✅ `backend/src/modules/turnos/turnos.service.js`
- ✅ `backend/src/modules/pacientes/pacientes.service.js`

### 2. Validación de membresía activa

**Archivos modificados**: 
- `membresias.service.js` - `getCurrentMembershipByUserId()`
- `auth.repository.js` - `findUserByEmail()`, `findUserById()`

La lógica de `activa_vigente` ahora es:

```javascript
CASE
  -- Si está en trial y aún tiene días disponibles
  WHEN m.es_trial = 1 AND (m.fecha_fin_trial IS NULL OR m.fecha_fin_trial >= CURDATE()) THEN 1
  -- Si es un plan pagado y aún tiene acceso
  WHEN m.es_trial = 0 AND (m.pagado_hasta IS NULL OR m.pagado_hasta >= CURDATE()) THEN 1
  -- En cualquier otro caso, no tiene acceso
  ELSE 0
END
```

### 3. Bloqueo de acceso en login

**Función modificada**: `auth.service.js` - `login()` y `getCurrentUser()`

Se agregó validación que:
- Bloquea login si la membresía no está `activa_vigente`
- Retorna HTTP 402 (Payment Required)
- Mensajes específicos según el caso:
  - Trial expirado: `"Tu período de prueba terminó el [FECHA]. Debes contratar un plan..."`
  - Membresía vencida: `"Tu membresía está vencida desde [FECHA]. Renová tu suscripción..."`

### 4. Información de trial en el payload del usuario

**Función modificada**: `auth.service.js` - `buildUserPayload()`

Ahora el response incluye información del trial:

```javascript
membresia: {
  id_membresia: null,
  plan_codigo: "medio",
  plan_nombre: "Medio",
  es_trial: true,
  fecha_inicio_trial: "2026-08-10",
  fecha_fin_trial: "2026-09-09",
  pagado_hasta: "2026-09-09",
  activa_vigente: true,
  permite_turnos: true,
  permite_asistentes: false,
  // ...
}
```

---

## 🔄 Flujo de usuario

### Durante los 30 días de prueba:

1. **Registro**: Usuario elige plan (ej: "medio")
2. **DB**: Se crea membresía con:
   - `es_trial = 1`
   - `fecha_inicio_trial = hoy`
   - `fecha_fin_trial = hoy + 30 días`
   - `pagado_hasta = hoy + 30 días`
3. **Acceso**: Usuario PUEDE:
   - Hacer login ✅
   - Acceder al dashboard ✅
   - Usar turnos (si el plan lo permite) ✅
   - Usar asistentes (si el plan lo permite) ✅

### Después de 30 días:

4. **Login**: Se rechaza con HTTP 402
   - Mensaje: "Tu período de prueba terminó el 2026-09-09..."
   - Usuario no puede entrar al sistema

5. **Opciones**:
   - Contratar el plan → membresía se actualiza
   - No contratar → Sin acceso

---

## 🧪 Testing

Para probar la implementación:

1. **Ejecutar migration**: 
   ```bash
   mysql < backend/sql/016_trial_period.sql
   ```

2. **Registrar un médico** con plan "medio" → Se crea con 30 días gratis

3. **Verificar DB**:
   ```sql
   SELECT es_trial, fecha_inicio_trial, fecha_fin_trial, pagado_hasta 
   FROM membresias 
   WHERE id_usuario = ?;
   ```
   
   Resultado esperado:
   ```
   es_trial=1, fecha_inicio_trial=2026-08-10, fecha_fin_trial=2026-09-09, pagado_hasta=2026-09-09
   ```

4. **Probar login** → Debe permitir dentro de 30 días
5. **Cambiar fecha en DB** a fecha_fin_trial < hoy → Login debe retornar HTTP 402

---

## 📝 Notas importantes

- **Solo afecta a médicos y gerentes**: Los pacientes no tienen membresía
- **Triggers de bloqueo**: login y GET /me
- **Turnos y asistentes**: Ya tenían validación de membresía activa (no cambia)
- **Plan trial gratis = plan solicitado**: Si elige "profesional", durante 30 días accede a todas las features de profesional sin pagar

---

## ⚙️ Archivos modificados

- ✅ `backend/sql/016_trial_period.sql` (NUEVA)
- ✅ `backend/src/modules/auth/auth.service.js`
- ✅ `backend/src/modules/auth/auth.repository.js`
- ✅ `backend/src/modules/membresias/membresias.service.js`
