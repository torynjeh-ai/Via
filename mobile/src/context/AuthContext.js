import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../api/users';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const t = await SecureStore.getItemAsync('token');
        if (t) {
          setToken(t);
          const res = await getMe();
          setUser(res.data);
        }
      } catch {
        await SecureStore.deleteItemAsync('token');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const signIn = async (t, u) => {
    await SecureStore.setItemAsync('token', t);
    setToken(t);
    setUser(u);
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
