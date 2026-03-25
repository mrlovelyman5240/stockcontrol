import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Set up axios defaults when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Verify token and get user on mount
  const verifyAuth = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      // Set header before making request
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      const response = await axios.get(`${API_URL}/api/auth/me`);
      setUser(response.data);
      setToken(storedToken);
    } catch (error) {
      console.error('Auth verification failed:', error);
      // Clear invalid token
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password
      });
      
      const { access_token, user: userData } = response.data;
      
      // Store token and update state
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setToken(access_token);
      setUser(userData);
      
      console.log('Login success - User:', userData.username, 'Role:', userData.role);
      
      return { success: true, user: userData };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg) || 'Login failed';
      return { success: false, error: message };
    }
  };

  // Function for Boss to create new users (drivers, customer service)
  const createUser = async (username, password, role, fullName) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        password,
        role,
        full_name: fullName || username
      });
      return { success: true, user: response.data.user };
    } catch (error) {
      const detail = error.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg) || 'Failed to create user';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    loading,
    login,
    createUser, // Boss-only function to create users
    logout,
    isAuthenticated: !!user && !!token,
    isBoss: user?.role === 'boss',
    isCustomerService: user?.role === 'customer_service',
    isDriver: user?.role === 'driver'
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

export default AuthContext;
