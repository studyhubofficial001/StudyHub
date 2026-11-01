const AUTH_TOKEN_KEY = 'token';

export const getAuthToken = () => sessionStorage.getItem(AUTH_TOKEN_KEY);

export const setAuthToken = (token) => sessionStorage.setItem(AUTH_TOKEN_KEY, token);

export const clearAuthToken = () => sessionStorage.removeItem(AUTH_TOKEN_KEY);
