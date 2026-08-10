# Implementación de Seguridad - Resumen

## ✅ IMPLEMENTADO

### 1. **Helmet.js - Headers de Seguridad**
- **Archivo**: `backend/src/app.js`
- **Instalado**: `helmet@^7.1.0` en `package.json`

Protege contra:
- ✅ XSS (Cross-Site Scripting)
- ✅ Clickjacking
- ✅ MIME type sniffing
- ✅ Varias técnicas de ataques de navegador

Implementado con:
```javascript
const helmet = require('helmet')
app.use(helmet())  // Se ejecuta primero
```

---

### 2. **Rate Limiting Global**
- **Archivo**: `backend/src/app.js`
- **Configuración**: 100 requests por IP cada 15 minutos

Se aplica a:
- ✅ Todos los endpoints `/api/*`
- ✅ Excepto: `GET /` (health check)

```javascript
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                   // 100 requests máximo
  message: 'Demasiadas solicitudes. Reintentá en 15 minutos.',
})
app.use('/api', globalLimiter)
```

**Además de:**
- ✅ Rate limit específico en `/auth/login` (5 intentos/10 min)

---

### 3. **HTTPS Enforcement**
- **Archivo**: `backend/src/app.js`
- **Activo en**: Producción (`NODE_ENV === 'production'`)

**Comportamiento:**
- Si se recibe HTTP → Redirecciona a HTTPS con código 301 (movimiento permanente)
- Detecta HTTPS a través del header `x-forwarded-proto` (para proxies reversos)
- Solo se aplica en producción

```javascript
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`)
    }
    next()
  })
}
```

---

## 📝 **PRÓXIMO PASO: Input Validation (Opción 4)**

Para implementar validación de inputs, necesito que tomes decisiones sobre:

### **A. ESTRATEGIA**: ¿Dónde validar?

**Opción A1**: Middleware global (valida todo automáticamente)
```javascript
app.use(validateInputs)  // Se ejecuta en todas las requests
```
- ✅ Más seguro (no se puede "olvidar" en endpoints)
- ❌ Más complejo, puede rechazar requests válidas

**Opción A2**: En cada service/controller (más granular)
```javascript
// En auth.service.js
if (email.length > 255) throw HttpError(400, 'Email muy largo')
if (!email.includes('@')) throw HttpError(400, 'Email inválido')
```
- ✅ Más control, mensajes específicos
- ❌ Código repetido, más mantenimiento

**Recomendación**: A2 (más pragmático)

---

### **B. QUÉ CAMPOS VALIDAR** 

¿Cuáles de estos deberían validar?

| Campo | Módulo | Validación | Máximo |
|-------|--------|-----------|--------|
| `email` | auth | Formato email válido | 255 |
| `password` | auth | 8+ chars, letra + número | 255 |
| `nombre` | pacientes, medicos, gerentes | Alfanumérico, sin scripts | 100 |
| `apellido` | pacientes, medicos, gerentes | Alfanumérico | 100 |
| `dni` | pacientes, medicos | 7-8 dígitos | 8 |
| `matricula` | medicos | Alfanumérico | 20 |
| `teléfono` | pacientes, medicos, gerentes, clinicas | Solo dígitos y guiones | 20 |
| `bio` | medicos | Texto, sin scripts | 500 |
| `fecha_nac` | pacientes | Formato date válido | - |
| `especialidad` | medicos | Alfanumérico | 100 |
| `descripcion` | clinicas | Texto | 500 |
| `asunto` (mensaje) | pacientes | Texto | 150 ✓ (ya limitado) |
| `mensaje` | pacientes | Texto | 2000 |
| `medicamento` | pacientes | Texto | 100 |
| `dosis` | pacientes | Texto | 50 |

¿Validar todos? ¿Solo los críticos (email, password, dni)?

---

### **C. SANITIZACIÓN**: ¿Remover caracteres peligrosos?

**HTML/XSS Prevention**:
```javascript
// Input peligroso: "<script>alert('xss')</script>"

// Opción C1: Rechazar (lenient)
if (bio.includes('<') || bio.includes('>')) {
  throw HttpError(400, 'No se permiten caracteres especiales')
}

// Opción C2: Escapar (safety)
const sanitized = bio.replace(/[<>]/g, '')

// Opción C3: Librería (robust)
const DOMPurify = require('isomorphic-dompurify')
const clean = DOMPurify.sanitize(bio)
```

**Recomendación**: C1 o C2 (sin librerías adicionales)

---

### **D. MENSAJES DE ERROR**: ¿Genéricos o específicos?

**Opción D1**: Genéricos (más seguro)
```javascript
if (email.length > 255) throw HttpError(400, 'Datos inválidos')
// Usuario no sabe qué fue el problema
```

**Opción D2**: Específicos (UX mejor)
```javascript
if (email.length > 255) throw HttpError(400, 'El email no puede superar 255 caracteres')
// Usuario sabe exactamente qué corregir
```

**Recomendación**: D2 (es SPA, mensajes vienen del servidor igualmente)

---

## 🎯 **OPCIONES RÁPIDAS** 

Elige una de estas:

### **OPCIÓN LIGERA** (30 min)
- Validar solo: email, password, dni
- Rechazar caracteres `< >` en campos de texto
- Mensajes específicos

### **OPCIÓN MEDIA** (1 hora)
- Validar: email, password, dni, teléfono, longitudes de texto
- Rechazar caracteres `< >` y scripts
- Mensajes específicos

### **OPCIÓN COMPLETA** (2 horas)
- Validar todo (tabla arriba)
- Regex patterns para cada tipo (email, teléfono, fecha)
- Sanitización completa
- Mensajes específicos

---

## 📋 **CHECKLIST ACTUALIZADO**

- [x] SQL Injection protected
- [x] JWT authentication
- [x] Role-based access control
- [x] CORS configured
- [x] Password hashing (bcrypt)
- [x] Rate limiting (global + login)
- [x] Helmet.js security headers ← **NUEVO**
- [x] HTTPS enforcement ← **NUEVO**
- [ ] Input validation ← **PENDIENTE**
- [ ] Error logging
- [ ] Data sanitization (XSS prevention)

---

## 🚀 **PRÓXIMOS PASOS**

1. **Responde**: Elige opciones A, B, C, D (o una de las 3 opciones rápidas)
2. **Implemento**: Validación de inputs
3. **Testing**: Verificamos que todo funciona
