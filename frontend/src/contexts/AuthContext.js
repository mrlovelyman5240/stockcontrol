import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

// Auth state is server-driven: the HttpOnly auth cookie set by /auth/login is
// the source of truth, JS can't read it, so on every mount we ping /auth/me to
// learn whether the browser still has a valid session. No tokens in localStorage.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifyAuth = useCallback(async () => {
    try {
      const response = await authApi.me();
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { verifyAuth(); }, [verifyAuth]);

  const refreshUser = async () => {
    try {
      const response = await authApi.me();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await authApi.login(username, password);
      // Backend Set-Cookie carries the session; we only keep user profile in state.
      setUser(response.data.user);
      return { success: true, user: response.data.user };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg) || 'Login failed';
      return { success: false, error: message };
    }
  };

  const createUser = async (username, password, role, fullName) => {
    try {
      const response = await authApi.register({
        username, password, role, full_name: fullName || username,
      });
      return { success: true, user: response.data.user };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg) || 'Failed to create user';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Logout should always succeed client-side even if the server is unreachable.
    } finally {
      setUser(null);
    }
  };

  const value = {
    user, loading, login, createUser, logout, refreshUser,
    isAuthenticated: !!user,
    isBoss: user?.role === 'boss',
    isCustomerService: user?.role === 'customer_service',
    isDriver: user?.role === 'driver',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
