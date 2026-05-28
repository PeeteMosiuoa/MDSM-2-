"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as storeLogin, register as storeRegister } from "./store";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("mdsm_session");
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback((email, password) => {
    const result = storeLogin(email, password);
    if (result) {
      setUser(result);
      localStorage.setItem("mdsm_session", JSON.stringify(result));
      return { success: true, user: result };
    }
    return { success: false, error: "Invalid credentials or account suspended" };
  }, []);

  const register = useCallback((userData) => {
    const result = storeRegister(userData);
    if (result.error) return { success: false, error: result.error };
    setUser(result);
    localStorage.setItem("mdsm_session", JSON.stringify(result));
    return { success: true, user: result };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("mdsm_session");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
