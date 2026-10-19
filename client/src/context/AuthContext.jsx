import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosInstance';
import { getAdminResources, getResourceDownloadUrl } from '../api/resourcesApi';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadedResources, setUploadedResources] = useState([]);
  const [downloadUrls, setDownloadUrls] = useState({});

  const refreshResources = async () => {
    if (!user || user.role !== 'admin') {
      setUploadedResources([]);
      setDownloadUrls({});
      return;
    }

    try {
      const response = await getAdminResources();
      const resources = response.data || [];
      setUploadedResources(resources);

      const urls = {};
      await Promise.all(resources.map(async (resource) => {
        try {
          const downloadUrlResponse = await getResourceDownloadUrl(resource._id);
          urls[resource._id] = downloadUrlResponse.data.downloadUrl;
        } catch (error) {
          console.error(`Error fetching download URL for resource ${resource._id}:`, error);
        }
      }));

      setDownloadUrls(urls);
    } catch (error) {
      if (error.response?.status !== 401 && error.response?.status !== 403) {
        console.error('Error fetching resources:', error);
      }
      setUploadedResources([]);
      setDownloadUrls({});
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
        setDownloadUrls({});
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
      setDownloadUrls({});
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      isAuthenticated: !!user,
      uploadedResources,
      downloadUrls,
      setUploadedResources,
      setDownloadUrls,
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