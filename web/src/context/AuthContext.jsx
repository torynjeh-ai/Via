import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../api/users';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe().then(res => setUser(res.data)).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = (token, u) => { localStorage.setItem('token', token); setUser(u); };
  const signOut = () => { localStorage.removeItem('token'); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, signIn, signOut, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
