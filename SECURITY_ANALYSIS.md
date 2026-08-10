# Análisis de Seguridad - Agisad Backend

## 📊 Estado actual de seguridad

### ✅ IMPLEMENTADO - Lo que TIENE:

#### 1. **Rate Limiting (Limitado)**
- ✅ `rateLimit.middleware.js` - Implementado en login
  - 5 intentos fallidos en 10 minutos
  - Protege contra fuerza bruta en login
- ⚠️ **LIMITADO**: Solo en login, no en otros endpoints críticos (POST, PUT, DELETE)

#### 2. **SQL Injection Prevention**
- ✅ Usa `mysql2/promise` con **prepared statements**
- ✅ Named placeholders: `?.execute(sql, params)`
- ✅ Ejemplo: `WHERE email = :email` (parámetro seguro)
- **NOTA**: Todos los queries usan parámetros, no concatenación de strings

#### 3. **Autenticación**
- ✅ JWT (JSON Web Token) 
- ✅ `requireAuth` middleware valida Bearer tokens
- ✅ `requireRoles` middleware valida permisos por rol
- ✅ Tokens con expiración

#### 4. **CORS Protection**
- ✅ Configurado en `app.js`
- ✅ Whitelist de orígenes permitidos
- ✅ `env.CORS_ALLOWED_ORIGINS` desde variables de entorno

#### 5. **SSL/TLS para DB**
- ✅ Soporta SSL en conexión a MySQL
- ✅ Configurable: `env.DB_SSL`, `env.DB_SSL_REJECT_UNAUTHORIZED`

#### 6. **Request Size Limit**
- ✅ `limit: '1mb'` en `express.json()` y `urlencoded()`
- Previene ataques de payload gigante

---

### ❌ NO IMPLEMENTADO - Lo que FALTA:

#### 1. **API Key Authentication**
- ❌ No existe (probablemente innecesario si es SPA + JWT)
- Útil si necesitas permitir acceso desde scripts/clientes no-navegador
- Generalmente necesario para APIs públicas o servicios de terceros

#### 2. **Rate Limiting Global**
- ❌ Solo en login, no en:
  - `POST /turnos` - Agendación de turnos
  - `POST /recetas` - Solicitud de recetas
  - `POST /mensajes` - Mensajes
  - `GET /turnos` - Listado de turnos
  - Otros endpoints POST/PUT/DELETE

#### 3. **Validación y Sanitización**
- ⚠️ Básica en algunos lugares
- Falta: máx/mín longitudes, patrones regex, sanitización HTML
- Ejemplo: Un campo de `nombre` podría recibir 10,000 caracteres

#### 4. **HTTPS Enforcement**
- ❌ No hay redirección HTTP → HTTPS en `app.js`
- ❌ No hay headers `Strict-Transport-Security`
- ⚠️ Si está en producción sin HTTPS = datos expuestos

#### 5. **Helmet.js (Security Headers)**
- ❌ No implementado
- Protege contra: XSS, Clickjacking, MIME sniffing, etc.

#### 6. **Input Validation**
- ⚠️ Mínima en algunos módulos
- Email, DNI, teléfono - sin validación de formato
- Campos numéricos - sin verificar rango
- Fechas - sin validar formato

#### 7. **Logging de Seguridad**
- ❌ No hay registro de:
  - Intentos de acceso no autorizados
  - Cambios en datos críticos
  - Errores SQL
  - Acciones sospechosas

#### 8. **CSRF Protection**
- ⚠️ Parcial - SPA con JWT es relativamente segura
- Si fuera formularios HTML tradicionales, necesitaría tokens CSRF

#### 9. **Data Encryption**
- ❌ Contraseñas están hasheadas (bcrypt) ✅
- ❌ Datos sensibles (DNI, teléfono) NO están encriptados
- ⚠️ Almacenados en texto plano en DB

#### 10. **API Versioning & Deprecation**
- ❌ No hay versionado de API (`/v1/`, `/v2/`)
- Cambios futuros = problemas para clientes externos

---

## 🎯 ¿Qué es NECESARIO implementar?

### CRÍTICO (Hazlo ya):
1. **Rate Limiting global** - Otros endpoints además de login
2. **Helmet.js** - Headers de seguridad (5 min para instalar)
3. **Input Validation** - Validar tipos, longitudes, formatos
4. **HTTPS Enforcement** - Redirección + HSTS headers
5. **Error Handling** - No exponer detalles de errores internos

### IMPORTANTE (Hazlo pronto):
6. **Logging** - Registrar acciones críticas
7. **Data Sanitization** - Limpiar inputs (XSS prevention)
8. **Environment Secrets** - Asegurar que .env no se commitea

### RECOMENDADO (Si crece):
9. **API Key Auth** - Si necesitas clientes no-SPA (mobile app, webhooks)
10. **Data Encryption** - Para DNI, teléfono, datos sensibles
11. **API Versioning** - Para mantener compatibilidad

---

## 🔒 VULNERABILIDADES POTENCIALES DETECTADAS

### 1. **SQL Injection**: ✅ PROTEGIDO
```javascript
// ✅ SEGURO - Usa parámetros
const rows = await query(
  `SELECT * FROM usuarios WHERE email = :email`,
  { email: userInput }  // No puede ser inyectado
)

// ❌ INSEGURO (no se hace, pero si pasara):
const sql = `SELECT * FROM usuarios WHERE email = '${userInput}'`
```

### 2. **XSS (Cross-Site Scripting)**: ⚠️ PARCIALMENTE PROTEGIDO
```javascript
// El backend no protege, depende del frontend
// Si frontend no sanitiza, podría pasar <script> en campos

// FALTA: Helmet.js + Content-Security-Policy
```

### 3. **CSRF (Cross-Site Request Forgery)**: ✅ PROTEGIDO
```javascript
// JWT en header Authorization es CSRF-safe
// (No se puede enviar desde <form> en otro sitio)
// ✅ SPA + JWT = CSRF protegido automáticamente
```

### 4. **Acceso no autorizado**: ✅ PROTEGIDO CON LÍMITES
```javascript
// ✅ Médico solo puede ver sus pacientes
// ✅ Paciente solo puede ver su perfil
// ✅ Roles validados en middleware

// ⚠️ PERO: Sin rate limiting en endpoints sensibles
// Alguien podría hacer 1000 requests/segundo a POST /turnos
```

### 5. **Exposición de información**: ⚠️ RIESGO BAJO
```javascript
// Los errores devuelven mensajes genéricos
// Ejemplo: "Credenciales invalidas" (no revela si email existe)
// ✅ Buena práctica

// ⚠️ PERO: Stack traces podrían exponerse en errores no capturados
```

---

## 📋 RECOMENDACIONES DE IMPLEMENTACIÓN

### OPCIÓN 1: Mínimo recomendado (1 hora)
```bash
npm install helmet
```

En `app.js`:
```javascript
const helmet = require('helmet');
app.use(helmet());
```

Agregar rate limiting global:
```javascript
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 requests por IP
});
app.use('/api/', generalLimiter);
```

### OPCIÓN 2: Seguridad robusta (3 horas)
- Implementar todo lo anterior
- Agregar input validation en pacientes, medicos, turnos modules
- Agregar logging de acciones críticas
- Configurar HTTPS enforcement

### OPCIÓN 3: Seguridad enterprise (1 día)
- Todo lo anterior
- Data encryption para DNI/teléfono
- API versioning
- API Key authentication para terceros
- Web Application Firewall (WAF) en Nginx/reverse proxy

---

## ⚡ URGENCIA POR CONTEXTO

### Si es DESARROLLO/TESTING local:
❌ No es urgente - Puedes trabajar sin estas medidas

### Si es STAGING/PRUEBAS:
⚠️ Moderadamente urgente - Implementa Opción 1 mínimo

### Si es PRODUCCIÓN CON DATOS REALES:
🔴 **CRÍTICO** - Implementa Opción 2 completa AHORA
- Datos de usuarios (email, teléfono, DNI)
- Información médica (turnos, recetas, antecedentes)
- Información de clínicas/gerentes

---

## ✅ CHECKLIST DE SEGURIDAD

- [x] SQL Injection protected (prepared statements)
- [x] JWT authentication
- [x] Role-based access control
- [x] CORS configured
- [x] Password hashing (bcrypt)
- [ ] Rate limiting (global)
- [ ] Helmet.js security headers
- [ ] HTTPS enforcement
- [ ] Input validation
- [ ] Error logging
- [ ] Data sanitization (XSS prevention)
- [ ] Data encryption (sensitive fields)
- [ ] API key authentication (si aplica)

