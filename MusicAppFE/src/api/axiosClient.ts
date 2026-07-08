import axios from 'axios';

const BACKEND_URL = `http://${window.location.hostname}:8080`;

export const axiosClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Removed request interceptor because cookies are sent automatically with `withCredentials: true`

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
      // Clear token state and redirect to login if unauthorized
      localStorage.removeItem('music_app_logged_in');
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
