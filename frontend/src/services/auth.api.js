import { api } from './apiClient'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register/paciente', data),
  registerPaciente: (data) => api.post('/auth/register/paciente', data),
  registerMedico: (data) => api.post('/auth/register/medico', data),
  registerGerente: (data) => api.post('/auth/register/gerente', data),
  registerAsistente: (data) => api.post('/asistentes', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post(`/auth/reset-password/${token}`, { password }),
}
