import axios from 'axios';
import { getAuthToken } from './authTokenStorage';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ,
    withCredentials: true, // send the cookie with every request
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

export default api;