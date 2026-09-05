import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setToken, getToken } from '../api/client.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  };
  const register = async (payload) => {
    const { token, user } = await api.post('/auth/register', payload);
    setToken(token);
    setUser(user);
    return user;
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
