import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getDeviceInfo } from "../utils/device";

const AuthContext = createContext(null);
const TOKEN_KEY = "razk_token";
const USER_KEY = "razk_user";

const getSessionValue = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setSessionValue = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in strict privacy modes.
  }
};

const clearAuthStorage = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Storage cleanup is best-effort; React state is still cleared.
  }
};

const storedUser = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return JSON.parse(getSessionValue(USER_KEY)) || null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(storedUser);
  const [token, setToken] = useState(getSessionValue(TOKEN_KEY));
  const [authReady, setAuthReady] = useState(false);

  const clearSession = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  const login = async (credentials) => {
    const device = getDeviceInfo();
    const payload = {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      email: String(credentials.email || "").trim(),
      password: credentials.password
    };
    const { data } = await api.post("/auth/login", payload);
    if (data.requiresDeviceApproval || !data.token || !data.user) {
      throw new Error(data.message || "Device approval is required before login");
    }
    clearAuthStorage();
    setSessionValue(TOKEN_KEY, data.token);
    setSessionValue(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const refreshMe = async () => {
    if (!getSessionValue(TOKEN_KEY)) return null;
    try {
      const { data } = await api.get("/auth/me");
      setSessionValue(USER_KEY, JSON.stringify(data.user));
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
    window.addEventListener("razk:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("razk:auth-expired", handleAuthExpired);
  }, [clearSession]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!getSessionValue(TOKEN_KEY)) {
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
