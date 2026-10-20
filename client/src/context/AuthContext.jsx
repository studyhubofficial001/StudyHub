import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosInstance';
import { getAdminResources } from '../api/resourcesApi';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadedResources, setUploadedResources] = useState([]);

  const refreshResources = async () => {
    if (!user || user.role !== 'admin') {
      setUploadedResources([]);
      return;
    }

    try {
      const response = await getAdminResources();
      const resources = response.data || [];
      setUploadedResources(resources);
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Error fetching resources:', error);
      }
      setUploadedResources([]);
    }
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const authResponse = await api.get('/auth/me');
        const currentUser = authResponse.data.user;
        setUser(currentUser);

        if (currentUser?.role === 'admin') {
          await refreshResources();
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error('Error checking authentication status:', error);
        }
        setUser(null);
        setUploadedResources([]);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      refreshResources();
    }
  }, [user?.role]);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
      setUploadedResources([]);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      isAuthenticated: !!user,
      uploadedResources,
      setUploadedResources,
      refreshResources,
      loading,
      logout,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}