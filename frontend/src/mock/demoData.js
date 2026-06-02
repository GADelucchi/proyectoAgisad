const CLINICS_KEY = 'agisad-demo-clinics-by-doctor'
const ASSISTANTS_KEY = 'agisad-demo-assistants-by-doctor'

const DEFAULT_CLINICS = {
  1: [
    {
      id: 1,
      nombre: 'Virtual',
      tipo: 'virtual',
      ciudad: '',
      direccion: 'Videollamada',
      rangos: [
        {
          id: 1,
          frecuencia: 'semanal',
          dia: 'Lun',
          fecha: '',
          desde: '',
          hasta: '',
          dias: ['Lun', 'Mie', 'Vie'],
          inicio: '09:00',
          fin: '17:00',
        },
      ],
    },
    {
      id: 2,
      nombre: 'Caraga',
      tipo: 'presencial',
      ciudad: 'La Plata',
      direccion: 'Sin direccion',
      rangos: [
        {
          id: 1,
          frecuencia: 'semanal',
          dia: 'Mar',
          fecha: '',
          desde: '',
          hasta: '',
          dias: ['Mar', 'Jue', 'Sab'],
          inicio: '09:00',
          fin: '17:00',
        },
      ],
    },
  ],
  2: [
    {
      id: 1,
      nombre: 'Virtual',
      tipo: 'virtual',
      ciudad: '',
      direccion: 'Videollamada',
      rangos: [
        {
          id: 1,
          frecuencia: 'semanal',
          dia: 'Lun',
          fecha: '',
          desde: '',
          hasta: '',
          dias: ['Lun', 'Mie', 'Vie'],
          inicio: '09:00',
          fin: '17:00',
        },
      ],
    },
  ],
}

const DOCTORS = [
  {
    id: 1,
    nombre: 'Dr. Gustavo A. Delucchi',
    especialidad: 'Prof. de Psiquiatria',
    matricula: 'M.P. 18.395',
    plan: 'profesional',
  },
  {
    id: 2,
    nombre: 'Dra. Demo Medica',
    especialidad: 'Medica Clinica',
    matricula: 'M.P. 99.999',
    plan: 'intermedio',
  },
]

const DEFAULT_ASSISTANTS = {
  1: [
    {
      id: 1,
      nombre: 'Maria Secretaria',
      usuario: 'sec.maria',
      estado: 'bloqueada',
      permisos: { agenda: true, pacientes: false },
    },
    {
      id: 2,
      nombre: 'Ana Secretaria',
      usuario: 'sec.ana',
      estado: 'activa',
      permisos: { agenda: true, pacientes: true },
    },
  ],
  2: [
    {
      id: 3,
      nombre: 'Asistente Demo 2',
      usuario: 'sec.demo2',
      estado: 'activa',
      permisos: { agenda: true, pacientes: false },
    },
  ],
}

function parseStoredClinics() {
  const raw = localStorage.getItem(CLINICS_KEY)
  if (!raw) {
    localStorage.setItem(CLINICS_KEY, JSON.stringify(DEFAULT_CLINICS))
    return structuredClone(DEFAULT_CLINICS)
  }

  try {
    const parsed = JSON.parse(raw)
    return { ...structuredClone(DEFAULT_CLINICS), ...parsed }
  } catch {
    localStorage.setItem(CLINICS_KEY, JSON.stringify(DEFAULT_CLINICS))
    return structuredClone(DEFAULT_CLINICS)
  }
}

function parseStoredAssistants() {
  const raw = localStorage.getItem(ASSISTANTS_KEY)
  if (!raw) {
    localStorage.setItem(ASSISTANTS_KEY, JSON.stringify(DEFAULT_ASSISTANTS))
    return structuredClone(DEFAULT_ASSISTANTS)
  }

  try {
    const parsed = JSON.parse(raw)
    return { ...structuredClone(DEFAULT_ASSISTANTS), ...parsed }
  } catch {
    localStorage.setItem(ASSISTANTS_KEY, JSON.stringify(DEFAULT_ASSISTANTS))
    return structuredClone(DEFAULT_ASSISTANTS)
  }
}

function notifyDemoDataChanged() {
  window.dispatchEvent(new CustomEvent('agisad-demo-data-changed'))
}

export function getClinicsByDoctor(doctorId) {
  const clinicsByDoctor = parseStoredClinics()
  return clinicsByDoctor[String(doctorId)] || []
}

export function setClinicsByDoctor(doctorId, clinics) {
  const clinicsByDoctor = parseStoredClinics()
  clinicsByDoctor[String(doctorId)] = clinics
  localStorage.setItem(CLINICS_KEY, JSON.stringify(clinicsByDoctor))
  notifyDemoDataChanged()
}

export function getAssistantsByDoctor(doctorId) {
  const assistantsByDoctor = parseStoredAssistants()
  return assistantsByDoctor[String(doctorId)] || []
}

export function setAssistantsByDoctor(doctorId, assistants) {
  const assistantsByDoctor = parseStoredAssistants()
  assistantsByDoctor[String(doctorId)] = assistants
  localStorage.setItem(ASSISTANTS_KEY, JSON.stringify(assistantsByDoctor))
  notifyDemoDataChanged()
}

export function getAssistantAccess(username) {
  const assistantsByDoctor = parseStoredAssistants()
  const doctorIds = Object.keys(assistantsByDoctor)

  for (const doctorId of doctorIds) {
    const assistant = (assistantsByDoctor[doctorId] || []).find(a => a.usuario === username)
    if (assistant) {
      const blocked = assistant.estado !== 'activa'
      const basePerms = assistant.permisos || { agenda: true, pacientes: false }
      return {
        doctorId: Number(doctorId),
        assistant,
        blocked,
        permissions: {
          agenda: blocked ? true : Boolean(basePerms.agenda),
          pacientes: blocked ? false : Boolean(basePerms.pacientes),
        },
      }
    }
  }

  return {
    doctorId: 1,
    assistant: null,
    blocked: true,
    permissions: { agenda: true, pacientes: false },
  }
}

export function getDemoDoctors() {
  const clinicsByDoctor = parseStoredClinics()
  return DOCTORS.map(doctor => ({
    ...doctor,
    consultorios: (clinicsByDoctor[String(doctor.id)] || []).map(c => c.nombre),
  }))
}

export function getDemoDoctorById(doctorId) {
  const doctor = DOCTORS.find(d => String(d.id) === String(doctorId))
  if (!doctor) return null
  const clinics = getClinicsByDoctor(doctorId)
  return {
    ...doctor,
    consultorios: clinics.map(c => c.nombre),
  }
}

export function summarizeClinicDays(clinic) {
  if (!clinic?.rangos?.length) return 'Sin disponibilidad cargada'
  const first = clinic.rangos[0]
  if (first.frecuencia === 'semanal') return first.dia || 'Semanal'
  if (first.frecuencia === 'unica') return first.fecha || 'Unica vez'
  if (first.frecuencia === 'rango') {
    const from = first.desde || '--/--/----'
    const to = first.hasta || '--/--/----'
    return `${from} a ${to}`
  }
  return 'Disponibilidad cargada'
}
