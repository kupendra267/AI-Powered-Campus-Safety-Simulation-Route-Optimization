import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.warn("Logout request failed:", e);
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          const res = await authService.getProfile();
          if (isMounted) {
            if (res.success && res.data?.user) {
              setUser(res.data.user);
              localStorage.setItem('user', JSON.stringify(res.data.user));
            } else {
              clearSession();
            }
          }
        } catch (error) {
          console.warn("Session verification error:", error);
          if (isMounted) {
            clearSession();
          }
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [token, clearSession]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success && res.data) {
      const { user: userData, access_token } = res.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    return { success: false, message: res.message || 'Login failed' };
  };

  const register = async (name, email, password, role = 'STUDENT') => {
    const res = await authService.register(name, email, password, role);
    if (res.success && res.data) {
      const { user: userData, access_token } = res.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    return { success: false, message: res.message || 'Registration failed' };
  };

  const hasRole = (role) => {
    if (!user || !user.role) return false;
    return user.role.toUpperCase() === role.toUpperCase();
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'ADMIN',
    isStudent: user?.role === 'STUDENT',
    hasRole,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
