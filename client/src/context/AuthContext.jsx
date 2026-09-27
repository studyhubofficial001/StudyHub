import { createContext, useContext, useState, useEffect } from 'react';
const AuthContext = createContext();
import api from '../api/axiosInstance';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error('Error checking authentication status:', error);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error logging out:', error);
    }finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user,setUser,isAuthenticated: !!user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);