import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/auth.api";
import { STORAGE_KEYS } from "../services/apiClient";
import { normalizeUserForUi } from "../utils/userDisplay";

const AuthContext = createContext(null);

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

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    if (!token) return;

    let cancelled = false;

    async function refreshCurrentUser() {
      try {
        const user = await authApi.me();
        if (cancelled) return;
        const normalized = normalizeUserForUi(user);
        setUsuario(normalized);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalized));
      } catch {
        if (cancelled) return;
        setUsuario(null);
        localStorage.removeItem(STORAGE_KEYS.user);
        localStorage.removeItem(STORAGE_KEYS.token);
      }
    }

    refreshCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email, password) {
    console.info("[AuthContext.login] intento", { email });

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
      value={{ usuario, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
