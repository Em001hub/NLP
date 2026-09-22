import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(() => localStorage.getItem("ng_username"));
  const [token, setToken] = useState(() => localStorage.getItem("ng_token"));

  const login = useCallback(async (u, p) => {
    const data = await api.login(u, p);
    localStorage.setItem("ng_token", data.access_token);
    localStorage.setItem("ng_username", data.username);
    setToken(data.access_token);
    setUsername(data.username);
    return data;
  }, []);

  const signup = useCallback(async (u, p) => {
    const data = await api.signup(u, p);
    localStorage.setItem("ng_token", data.access_token);
    localStorage.setItem("ng_username", data.username);
    setToken(data.access_token);
    setUsername(data.username);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ng_token");
    localStorage.removeItem("ng_username");
    setToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider value={{ username, token, login, signup, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
