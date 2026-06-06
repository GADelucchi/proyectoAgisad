import { createContext, useContext, useState } from "react";
import { authApi } from "../services/auth.api";
import { STORAGE_KEYS } from "../services/apiClient";
import { normalizeUserForUi } from "../utils/userDisplay";

const AuthContext = createContext(null);
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

// Mock de usuario — reemplazar con llamadas reales al backend
const MOCK_USERS = {
  "medico@demo.com": {
    id: 1,
    rol: "medico",
    nombre: "Dr. Demo Médico",
    plan: "profesional",
  },
  "paciente@demo.com": {
    id: 2,
    rol: "paciente",
    nombre: "Paciente Demo",
    plan: null,
  },
  "asistente@demo.com": {
    id: 3,
    rol: "asistente",
    nombre: "Asistente Demo",
    username: "sec.ana",
    plan: null,
  },
  "gerente@demo.com": {
    id: 4,
    rol: "gerente",
    nombre: "Gerente Demo",
    plan: "gestion",
  },
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.user);
    try {
      const parsed = stored ? JSON.parse(stored) : null;
      return normalizeUserForUi(parsed);
    } catch {
      return null;
    }
  });

  async function login(email, password) {
    console.info("[AuthContext.login] intento", { email });

    if (DEMO_MODE) {
      const user = MOCK_USERS[email];
      if (!user) {
        console.warn("[AuthContext.login] demo sin match", { email });
        return false;
      }
      const normalized = normalizeUserForUi(user);
      setUsuario(normalized);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalized));
      console.info("[AuthContext.login] demo ok", normalized);
      return true;
    }

    const payload = await authApi.login(email, password);
    console.info("[AuthContext.login] api ok", payload?.user);
    const normalized = normalizeUserForUi(payload.user);
    setUsuario(normalized);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.token, payload.token);
    return true;
  }

  function logout() {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.token);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, login, logout, demoMode: DEMO_MODE }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
