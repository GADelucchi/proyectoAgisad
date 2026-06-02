const BASE = import.meta.env.VITE_API_BASE

export const STORAGE_KEYS = {
  token: 'agisad-token',
  user: 'agisad-user',
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message || 'Error de API')
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function buildUrl(path) {
  if (!BASE) {
    throw new Error('Falta VITE_API_BASE en el entorno del frontend')
  }

  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${BASE}${path}`
}

async function request(method, path, body) {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  const headers = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(buildUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    const isLoginRequest = typeof path === 'string' && path.includes('/auth/login')
    const message = isLoginRequest && res.status === 401
      ? 'Credenciales incorrectas.'
      : data?.message || data?.error || `Request failed with status ${res.status}`

    throw new ApiError(
      res.status,
      message,
      data?.details || null
    )
  }

  return data
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
}
