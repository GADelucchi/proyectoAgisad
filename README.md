# Agisad - Agenda Integral de Salud

Agisad es una plataforma web para médicos, asistentes y pacientes que centraliza la gestión de turnos, recetas, mensajes y operación diaria de consultorios.

## Propuesta de valor

- Pacientes autogestionan acciones clave: solicitar receta, pedir turno, cancelar turno y enviar consultas.
- Médicos administran agenda, consultorios, bloqueos, pacientes, historial y asistentes desde un solo panel.
- Asistentes trabajan con permisos configurables por médico.
- Modelo SaaS por suscripción mensual con funciones y límites por plan.

## Alcance inicial (V1 Frontend)

- Landing pública con presentación del producto.
- Autenticación unificada (paciente, médico, asistente).
- Registro de paciente con validación de email.
- Panel paciente: buscador de médico/centro, acciones según plan activo del médico.
- Flujo de turnos: consultorio -> tipo de consulta -> fecha -> horario -> confirmación.
- Flujo de recetas: formulario estructurado (medicamento + dosis/cantidad).
- Panel médico con pestañas:
  - Agenda
  - Configuración
  - Pacientes
  - Historial
- Panel asistente con los mismos módulos, respetando permisos.
- Centro de notificaciones configurable por médico.
- Aceptación de T&C por médico, registrada por paciente en primera acción.

## Roles

- Paciente
- Médico
- Asistente/Secretaría
- Admin de plataforma (operación comercial y alta de médicos)

## Planes de suscripción

### Plan Básico
- Solicitud de receta (estándar 7 días / urgente 24 horas)
- Envío de solicitud al mail del médico

### Plan Intermedio
- Incluye Plan Básico
- Autogestión de turnos (solicitar y cancelar)
- Recordatorios por email
- Hasta 4 consultorios
- Hasta 1 asistente

### Plan Profesional
- Incluye Plan Intermedio
- Reportes y métricas
- Historial de auditoría avanzado
- Centro de notificaciones configurable
- Soporte prioritario
- Hasta 3 asistentes en total

### Plan Empresarial
- Incluye Plan Profesional
- Multi-médico por cuenta
- Multi-asistentes sin límite fijo
- Permisos avanzados por sede
- Integraciones y API
- Pasarela de pago configurable por cuenta

## Stack objetivo

- Frontend: React + Vite
- Backend: Node.js
- Base de datos inicial: MySQL
- Evolución posible: PostgreSQL para analítica y reglas más complejas

## Decisiones técnicas confirmadas

- Una sola app web con control de roles (paciente / médico / asistente / admin)
- Base de datos: MySQL (V1), migración posible a PostgreSQL
- Confirmación de turno V1: sin pago (el médico confirma manualmente)
- Lista de espera: por orden de llegada estricto
- Registro de paciente: con validación de email obligatoria
- Alta de médico: manual por admin de la plataforma
- Buscador muestra solo médicos/clínicas con suscripción activa
- Modo día y modo noche desde V1
- Vista semanal de agenda incluida en V1

## Estado del proyecto

Arquitectura y wireframes V1 definidos. En construcción del frontend base.

Consultar especificación de pantallas y flujos en [docs/wireframes-v1.md](docs/wireframes-v1.md).
Consultar estructura del frontend en [docs/estructura-frontend.md](docs/estructura-frontend.md).
