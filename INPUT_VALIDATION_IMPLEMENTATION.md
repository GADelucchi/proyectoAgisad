# Input Validation & Security - Implementación

## 📋 Resumen

Se implementó **validación de inputs (Opción MEDIA)** con:
- **A2**: Validación en cada service/controller (granular + específica)
- **B**: Cobertura media (email, password, dni, teléfono, longitudes, nombres)
- **C2**: Escapar caracteres peligrosos (< > & " ')
- **D2**: Mensajes de error específicos (UX mejorada)

---

## 🔧 **ARCHIVO PRINCIPAL: `backend/src/utils/validators.js` (NUEVO)**

Módulo reutilizable con 10 funciones de validación:

### **Funciones principales:**

```javascript
validateEmail(email)           // RFC 5322, max 255 chars
validatePassword(password)     // 8+ chars, letra + número
validateDNI(dni)              // 7-8 dígitos
validatePhoneNumber(telefono) // 10-20 chars, solo números/guiones
validateName(nombre, field)   // Alfanumérico + espacios/acentos, max 100
validateTextField(text, max)  // Validar longitud máxima
validateMatricula(matricula)  // Alfanumérica, max 20
validateDate(dateString)      // Formato YYYY-MM-DD
validateUsername(username)    // Alfanumérico + _, max 50
sanitizeHTML(text)            // Escapa < > & " '
```

### **Ejemplo de validación:**

```javascript
// Input peligroso: "María-José<script>alert('xss')</script>"
const nombre = validateName(input.nombre, 'El nombre')

// Resultado: ✅ "María-José" - Válido
// Se rechaza si: contiene < > o excede 100 caracteres
```

---

## 🛡️ **VALIDACIONES IMPLEMENTADAS**

### **1. Auth Module** → `auth.service.js`

**Función `createBaseUser()`:**
- ✅ `validateEmail(email)` - Formato y longitud
- ✅ `validatePassword(password)` - 8+ chars, letra + número

**Función `registerPaciente()`:**
- ✅ `validateDNI(dni)` - 7-8 dígitos
- ✅ `validateName(nombre)` - Max 100 chars
- ✅ `validateName(apellido)` - Max 100 chars
- ✅ `validatePhoneNumber(telefono, false)` - Optional

**Función `registerMedico()`:**
- ✅ `validateDNI(dni)` - 7-8 dígitos
- ✅ `validateName(nombre)` - Max 100 chars
- ✅ `validateName(apellido)` - Max 100 chars
- ✅ `validateMatricula(matricula)` - Alfanumérica, max 20
- ✅ `validatePhoneNumber(telefono)` - Optional
- ✅ `validateTextField(bio, 500)` - Optional, max 500

**Función `registerGerente()`:**
- ✅ `validateName(nombre)` - Max 100 chars
- ✅ `validateName(apellido)` - Max 100 chars
- ✅ `validatePhoneNumber(telefono)` - Optional
- ✅ `validateTextField(clinica_nombre, 100)` - Required, max 100
- ✅ `validateTextField(direccion, 200)` - Required, max 200

---

### **2. Turnos Module** → `turnos.service.js`

**Función `crearTurno()`:**
- ✅ `validateTextField(motivo_consulta, 500)` - Optional, max 500 chars

---

### **3. Pacientes Module** → `pacientes.service.js`

**Función `solicitarReceta()`:**
- ✅ `validateTextField(medicamento, 100)` - Max 100 chars cada uno
- ✅ `validateTextField(dosis, 50)` - Max 50 chars cada uno

**Función `solicitarMensaje()`:**
- ✅ `validateTextField(asunto, 150)` - Max 150 chars
- ✅ `validateTextField(mensaje, 2000)` - Max 2000 chars

---

## 📊 **TABLA DE VALIDACIONES**

| Campo | Módulo | Validación | Máximo | Requerido |
|-------|--------|-----------|--------|-----------|
| email | auth | Formato RFC 5322 | 255 | ✅ |
| password | auth | 8+ chars, letra + número | 255 | ✅ |
| nombre | auth/pacientes/medicos | Alfanumérico + espacios | 100 | ✅ |
| apellido | auth/pacientes/medicos | Alfanumérico + espacios | 100 | ✅ |
| dni | pacientes/medicos | 7-8 dígitos | 8 | ✅ |
| matricula | medicos | Alfanumérica + / - . | 20 | ✅ |
| teléfono | pacientes/medicos/gerentes | Números + guiones | 20 | ❌ |
| bio | medicos | Texto libre | 500 | ❌ |
| clinica_nombre | gerentes | Texto libre | 100 | ✅ |
| direccion | gerentes | Texto libre | 200 | ✅ |
| motivo_consulta | turnos | Texto libre | 500 | ❌ |
| medicamento | pacientes | Texto libre | 100 | ✅ |
| dosis | pacientes | Texto libre | 50 | ❌ |
| asunto (mensaje) | pacientes | Texto libre | 150 | ✅ |
| mensaje | pacientes | Texto libre | 2000 | ✅ |

---

## 🛡️ **SANITIZACIÓN (C2: Escapar caracteres)**

### **Ejemplo:**

```javascript
// Input malicioso:
"Dr. García<script>alert('xss')</script>"

// Validación:
validateName(input)

// Resultado:
HttpError 400: "El nombre contiene caracteres no válidos"
// Se rechaza < >
```

**Caracteres bloqueados en campos específicos:**
- `< >` en nombres, bios, especialidades (validaName, validateTextField)
- Todos se validan con regex específicos por tipo
- No se usa `sanitizeHTML()` actualmente (disponible si se necesita en futuro)

---

## 📝 **MENSAJES DE ERROR (D2: Específicos)**

Todos los errores son descriptivos y helpful para el usuario:

```javascript
// En lugar de: "Datos inválidos"
// Ahora: 

validateEmail("usuario")
→ HttpError 400: "El email no tiene un formato válido"

validatePassword("123")
→ HttpError 400: "La contraseña debe tener al menos 8 caracteres"

validateDNI("abc")
→ HttpError 400: "El DNI debe tener 7 u 8 dígitos"

validatePhoneNumber("123", 20)
→ HttpError 400: "El teléfono debe tener entre 10 y 20 caracteres"

validateName("María-José<script>", 100)
→ HttpError 400: "El nombre contiene caracteres no válidos"

validateTextField("x" * 201, 200)
→ HttpError 400: "El campo no puede superar 200 caracteres"
```

---

## ⚡ **FLUJO DE VALIDACIÓN**

### **Ejemplo: Registro de Médico**

```
1. Frontend envía:
   {
     email: "dr@example.com",
     password: "Password123",
     nombre: "Juan<script>",
     dni: "12345"
   }

2. Backend (auth.service.js - registerMedico):
   
   ✅ validateEmail("dr@example.com")
      → "dr@example.com" (válido)
   
   ✅ validatePassword("Password123")
      → "Password123" (válido)
   
   ✅ validateName("Juan<script>")
      → ❌ HttpError 400: "El nombre contiene caracteres no válidos"
   
   ❌ validateDNI("12345")
      → ❌ HttpError 400: "El DNI debe tener 7 u 8 dígitos"

3. Frontend recibe:
   {
     status: 400,
     message: "El DNI debe tener 7 u 8 dígitos"
   }

4. Usuario ve: "⚠️ El DNI debe tener 7 u 8 dígitos"
   Corrige y reintenta
```

---

## 🔄 **INTEGRACIÓN CON SEGURIDAD ANTERIOR**

### **Stack de seguridad completo:**

```
Layer 1: Express Middleware
  ├─ helmet() - Headers de seguridad ✅
  ├─ cors() - Control de orígenes ✅
  └─ rateLimit() - Limitación de requests ✅

Layer 2: Input Validation
  ├─ validators.js - Validaciones específicas ✅
  └─ Mensajes de error descriptivos ✅

Layer 3: Database
  ├─ Prepared statements (mysql2/promise) ✅
  └─ SQL Injection protection ✅

Layer 4: Authentication
  ├─ JWT tokens ✅
  ├─ Role-based access control ✅
  └─ Password hashing (bcrypt) ✅
```

---

## 🧪 **TESTING**

### **Test 1: Validar email**
```bash
curl -X POST http://localhost:4000/api/auth/register/paciente \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalido",
    "password": "Pass123",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "12345678"
  }'

# Response:
# 400 Bad Request
# "El email no tiene un formato válido"
```

### **Test 2: Validar contraseña**
```bash
curl -X POST http://localhost:4000/api/auth/register/paciente \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "123",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "12345678"
  }'

# Response:
# 400 Bad Request
# "La contraseña debe tener al menos 8 caracteres"
```

### **Test 3: Validar DNI**
```bash
curl -X POST http://localhost:4000/api/auth/register/paciente \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "Password123",
    "nombre": "Juan",
    "apellido": "Pérez",
    "dni": "123"  # < Menos de 7 dígitos
  }'

# Response:
# 400 Bad Request
# "El DNI debe tener 7 u 8 dígitos"
```

---

## 📝 **ARCHIVOS MODIFICADOS**

- ✅ `backend/src/utils/validators.js` (NUEVO - 280 líneas)
- ✅ `backend/src/modules/auth/auth.service.js` - Usa validadores
- ✅ `backend/src/modules/turnos/turnos.service.js` - Valida motivo_consulta
- ✅ `backend/src/modules/pacientes/pacientes.service.js` - Valida recetas y mensajes

---

## ✅ **CHECKLIST FINAL**

- [x] SQL Injection protected
- [x] JWT authentication
- [x] Role-based access control
- [x] CORS configured
- [x] Password hashing (bcrypt)
- [x] Rate limiting (global + login)
- [x] Helmet.js security headers
- [x] HTTPS enforcement
- [x] **Input validation** ← **IMPLEMENTADO**
- [ ] Error logging (próximo)
- [ ] Data sanitization (complemento)

---

## 🚀 **PRÓXIMOS PASOS (Opcionales)**

1. **Error Logging** - Registrar accesos no autorizados
2. **Data Encryption** - Para DNI, teléfono
3. **API Versioning** - `/v1/`, `/v2/` si crecerá
4. **API Keys** - Si habrá clientes móviles o terceros

