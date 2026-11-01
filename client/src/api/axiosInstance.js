import axios from 'axios';
import { getAuthToken, setAuthToken } from './authTokenStorage';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true, // Include cookies in requests
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use((response) => {
    const token = response.data?.token;
    if (token) {
        setAuthToken(token);
    }
    return response;
});

export default api;