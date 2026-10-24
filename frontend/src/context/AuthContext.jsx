import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { api, setToken, getToken } from '../api/client.js';
import { auth, db, firebaseError as firebaseInitError } from '../firebase/index.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState(firebaseInitError);
  const [chatAvailable, setChatAvailable] = useState(Boolean(auth && db));
  const connectFirebase = useCallback(async () => {
    if (!auth || !db) {
      setChatAvailable(false);
      setFirebaseError(firebaseInitError || 'Chat is unavailable because Firebase is not configured.');
      return;
    }
    try {
      const { customToken } = await api.get('/auth/firebase-token');
      await signInWithCustomToken(auth, customToken);
      setFirebaseError('');
      setChatAvailable(true);
    } catch (error) {
      await signOut(auth).catch(() => {});
      setChatAvailable(false);
      setFirebaseError(`Chat is unavailable: ${error.message}`);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      if (auth) await signOut(auth).catch(() => {});
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
      await connectFirebase();
    } catch {
      setToken(null);
      setUser(null);
      if (auth) await signOut(auth).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [connectFirebase]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    await connectFirebase();
    return user;
  };
  const register = async (payload) => {
    const { token, user } = await api.post('/auth/register', payload);
    setToken(token);
    setUser(user);
    await connectFirebase();
    return user;
  };
  const logout = () => {
    setToken(null);
    setUser(null);
    if (auth) signOut(auth).catch((error) => setFirebaseError(error.message));
  };
  return (
    <AuthContext.Provider value={{ user, loading, firebaseError, chatAvailable, login, register, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
