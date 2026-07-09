import axios from 'axios';

const BACKEND_URL = `http://${window.location.hostname}:8080`;

export const axiosClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('music_app_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code === 1000) {
       return response.data.result !== undefined ? response.data.result : response.data;
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // If refresh fails, log out
    if (originalRequest.url === '/api/auth/refresh') {
      localStorage.removeItem('music_app_logged_in');
      localStorage.removeItem('music_app_access_token');
      localStorage.removeItem('music_app_refresh_token');
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (token) {
             originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return axiosClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('music_app_refresh_token');
        const res: any = await axiosClient.post('/api/auth/refresh', { refreshToken });
        let newAccessToken = null;
        if (res && res.accessToken) {
            newAccessToken = res.accessToken;
            localStorage.setItem('music_app_access_token', newAccessToken);
            if (res.refreshToken) {
                localStorage.setItem('music_app_refresh_token', res.refreshToken);
            }
        }
        processQueue(null, newAccessToken);
        if (newAccessToken) {
           originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return axiosClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('music_app_logged_in');
        localStorage.removeItem('music_app_access_token');
        localStorage.removeItem('music_app_refresh_token');
        if (window.location.pathname !== '/login') {
           window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    const apiMessage = error.response?.data?.message;
    if (apiMessage) {
      return Promise.reject(new Error(apiMessage));
    }
    return Promise.reject(error);
  }
);
