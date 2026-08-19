import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'Agisad'
const BASE_URL = 'https://agisad.ar'
const DEFAULT_TITLE = 'Agisad | Software de turnos y recetas para consultorios médicos'
const DEFAULT_DESC = 'Agisad es el sistema de gestión para consultorios y clínicas en Argentina: turnos online 24/7, recordatorios automáticos, solicitud de recetas y panel por rol. Probalo 30 días gratis.'

// Solo estas rutas se ofrecen a los buscadores; el resto va con noindex.
const SEO_BY_PATH = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  '/registro': {
    title: `Crear cuenta gratis | ${SITE_NAME}`,
    description: 'Creá tu cuenta en Agisad y probá 30 días gratis la gestión de turnos, recetas y pacientes de tu consultorio. Sin tarjeta de crédito.',
  },
  '/registro/profesional': {
    title: `Registro para profesionales de la salud | ${SITE_NAME}`,
    description: 'Registrate como médico o profesional de la salud y empezá a organizar tu agenda, tus recetas y tu base de pacientes desde un solo panel.',
  },
  '/registro/paciente': {
    title: `Registro de pacientes | ${SITE_NAME}`,
    description: 'Creá tu cuenta de paciente para sacar turnos online con tu profesional, solicitar recetas y gestionar tus consultas desde el celular.',
  },
  '/contacto': {
    title: `Contacto | ${SITE_NAME}`,
    description: 'Quién está detrás de Agisad y cómo comunicarse: soporte, facturación y datos del titular del servicio.',
  },
  '/terminos': {
    title: `Términos y condiciones | ${SITE_NAME}`,
    description: 'Condiciones de uso de Agisad: alcance del servicio, prueba gratuita, planes, pagos, baja y responsabilidades.',
  },
  '/privacidad': {
    title: `Política de privacidad | ${SITE_NAME}`,
    description: 'Cómo trata Agisad los datos personales y de salud según la Ley 25.326, y cómo ejercer tus derechos sobre ellos.',
  },
  '/login': { title: `Ingresar | ${SITE_NAME}`, noindex: true },
  // Alias de /registro/profesional: apunta a la URL preferida para no duplicar contenido.
  '/registro/medico': { title: `Registro para profesionales de la salud | ${SITE_NAME}`, noindex: true, canonical: '/registro/profesional' },
  '/registro/gerente': { title: `Registro de clínicas | ${SITE_NAME}`, noindex: true },
  '/verificar-email': { title: `Verificar email | ${SITE_NAME}`, noindex: true },
  '/recuperar-password': { title: `Recuperar contraseña | ${SITE_NAME}`, noindex: true },
}

const PREFIJOS_PRIVADOS = [
  { prefijo: '/nueva-password', title: `Nueva contraseña | ${SITE_NAME}` },
  { prefijo: '/paciente', title: `Panel de paciente | ${SITE_NAME}` },
  { prefijo: '/medico', title: `Panel médico | ${SITE_NAME}` },
  { prefijo: '/asistente', title: `Panel de asistente | ${SITE_NAME}` },
  { prefijo: '/gerente', title: `Panel de gerencia | ${SITE_NAME}` },
  { prefijo: '/admin', title: `Panel de administración | ${SITE_NAME}` },
]

function resolverSeo(pathname) {
  const exacto = SEO_BY_PATH[pathname]
  if (exacto) return { ...exacto, indexable: !exacto.noindex }

  const privado = PREFIJOS_PRIVADOS.find((r) => pathname === r.prefijo || pathname.startsWith(`${r.prefijo}/`))
  if (privado) return { title: privado.title, indexable: false }

  return { title: `Página no encontrada | ${SITE_NAME}`, indexable: false }
}

function upsertTag(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

function setMetaByName(name, content) {
  const el = upsertTag(`meta[name="${name}"]`, () => {
    const tag = document.createElement('meta')
    tag.setAttribute('name', name)
    return tag
  })
  el.setAttribute('content', content)
}

function setMetaByProperty(property, content) {
  const el = upsertTag(`meta[property="${property}"]`, () => {
    const tag = document.createElement('meta')
    tag.setAttribute('property', property)
    return tag
  })
  el.setAttribute('content', content)
}

export default function SeoManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    const normalizado = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    const config = resolverSeo(normalizado)
    const title = config.title || DEFAULT_TITLE
    const description = config.description || DEFAULT_DESC
    const canonical = `${BASE_URL}${config.canonical || (normalizado === '/' ? '/' : normalizado)}`

    document.title = title
    setMetaByName('description', description)
    setMetaByName('robots', config.indexable ? 'index, follow' : 'noindex, follow')
    setMetaByProperty('og:title', title)
    setMetaByProperty('og:description', description)
    setMetaByProperty('og:url', canonical)

    const link = upsertTag('link[rel="canonical"]', () => {
      const tag = document.createElement('link')
      tag.setAttribute('rel', 'canonical')
      return tag
    })
    link.setAttribute('href', canonical)
  }, [pathname])

  return null
}
