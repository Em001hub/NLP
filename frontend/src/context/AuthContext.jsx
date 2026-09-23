import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem("ng_token");
    // Ensure legacy dummy tokens are ignored
    if (saved && !saved.startsWith("ng_token_") && saved !== "ng_session_active") {
      return saved;
    }
    localStorage.removeItem("ng_token");
    return null;
  });

  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem("ng_token");
    if (saved && !saved.startsWith("ng_token_") && saved !== "ng_session_active") {
      return localStorage.getItem("ng_username") || "operator_01";
    }
    localStorage.removeItem("ng_username");
    return null;
  });

  const login = useCallback(async (u, p) => {
    const finalUsername = (u && u.trim()) ? u.trim() : "operator_01";
    const finalPassword = (p && p.trim()) ? p.trim() : "123456";

    const data = await api.login(finalUsername, finalPassword);
    const authToken = data.access_token;
    const userHandle = data.username || finalUsername;

    localStorage.setItem("ng_token", authToken);
    localStorage.setItem("ng_username", userHandle);
    setToken(authToken);
    setUsername(userHandle);
    return data;
  }, []);

  const guestLogin = useCallback(async () => {
    const data = await api.guest();
    const authToken = data.access_token;
    const userHandle = data.username || "operator_01";

    localStorage.setItem("ng_token", authToken);
    localStorage.setItem("ng_username", userHandle);
    setToken(authToken);
    setUsername(userHandle);
    return data;
  }, []);

  const signup = useCallback(async (u, p) => {
    const finalUsername = (u && u.trim()) ? u.trim() : "operator_01";
    const finalPassword = (p && p.trim()) ? p.trim() : "123456";

    const data = await api.signup(finalUsername, finalPassword);
    const authToken = data.access_token;
    const userHandle = data.username || finalUsername;

    localStorage.setItem("ng_token", authToken);
    localStorage.setItem("ng_username", userHandle);
    setToken(authToken);
    setUsername(userHandle);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ng_token");
    localStorage.removeItem("ng_username");
    setToken(null);
    setUsername(null);
  }, []);

  const user = username ? { username } : null;

  return (
    <AuthContext.Provider value={{ username, user, token, login, guestLogin, signup, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

