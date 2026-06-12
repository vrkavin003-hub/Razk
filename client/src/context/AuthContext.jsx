import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("hya_user")) || null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(storedUser);
  const [token, setToken] = useState(localStorage.getItem("hya_token"));
  const [authReady, setAuthReady] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem("hya_token");
    localStorage.removeItem("hya_user");
    setToken(null);
    setUser(null);
  }, []);

  const login = async (credentials) => {
    const payload = {
      email: String(credentials.email || "").trim(),
      password: credentials.password
    };
    const { data } = await api.post("/auth/login", payload);
    localStorage.setItem("hya_token", data.token);
    localStorage.setItem("hya_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const refreshMe = async () => {
    if (!localStorage.getItem("hya_token")) return null;
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("hya_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    const handleAuthExpired = () => clearSession();
    window.addEventListener("hya:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("hya:auth-expired", handleAuthExpired);
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!localStorage.getItem("hya_token")) {
        if (active) setAuthReady(true);
        return;
      }

      try {
        await refreshMe();
      } catch {
        // The API interceptor and refreshMe clear the stale session.
      } finally {
        if (active) setAuthReady(true);
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      authReady,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      refreshMe,
      token,
      user
    }),
    [authReady, token, user, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
