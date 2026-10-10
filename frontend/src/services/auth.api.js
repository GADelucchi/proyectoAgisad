import { api } from './apiClient'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  registerPaciente: (data) => api.post('/auth/register/paciente', data),
  registerMedico: (data) => api.post('/auth/register/medico', data),
  registerGerente: (data) => api.post('/auth/register/gerente', data),
  registerPropietario: (data) => api.post('/auth/register/propietario', data),
  registerAsistente: (data) => api.post('/asistentes', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
  verificarEmail: (email, codigo) => api.post('/auth/verificar-email', { email, codigo }),
  reenviarCodigo: (email) => api.post('/auth/verificar-email/reenviar', { email }),
}
