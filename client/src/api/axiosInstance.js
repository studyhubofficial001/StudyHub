import axios from 'axios';

// The login lives in an httpOnly cookie that the server sets. JavaScript never sees or stores the token,
// so nothing is kept in localStorage or sessionStorage, and the login survives closing the browser.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ,
    withCredentials: true, // send the cookie with every request
});

export default api;