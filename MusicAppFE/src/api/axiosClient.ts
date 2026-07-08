import axios from 'axios';

const BACKEND_URL = `http://${window.location.hostname}:8080`;

export const axiosClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
}

// Add a request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // Attempt to get token from cookie
    const token = getCookie('music_app_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    // If it's our ApiResponse format { code, message, result }, we can unwrap it directly
    if (response.data && response.data.code === 1000) {
       return response.data.result !== undefined ? response.data.result : response.data;
    }
    return response.data; // default unwrap for endpoints not using ApiResponse yet
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if unauthorized
      document.cookie = `music_app_token=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;Secure;SameSite=Strict`;
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    // Return the ErrorCode message if backend provides it
    const apiMessage = error.response?.data?.message;
    if (apiMessage) {
      return Promise.reject(new Error(apiMessage));
    }
    return Promise.reject(error);
  }
);
