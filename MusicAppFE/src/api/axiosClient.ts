import axios from 'axios';
let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
if (typeof window !== 'undefined' && envUrl.includes('localhost')) {
  envUrl = envUrl.replace('localhost', window.location.hostname);
}
export const BACKEND_URL = envUrl;

export const axiosClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  withXSRFToken: true,
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

const transformResponse = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(transformResponse);
  }
  if (data !== null && typeof data === 'object') {
    const newData = { ...data };
    for (const key in newData) {
      if (key === 'imageUrl' && typeof newData[key] === 'string' && newData[key].startsWith('/api/')) {
        newData[key] = BACKEND_URL + newData[key];
      } else {
        newData[key] = transformResponse(newData[key]);
      }
    }
    return newData;
  }
  return data;
};

axiosClient.interceptors.response.use(
  (response) => {
    if (response.data && response.data.code !== undefined) {
      if (response.data.code === 1000) {
        let result = response.data.result !== undefined ? response.data.result : response.data;
        return transformResponse(result);
      }
      return Promise.reject(new Error(response.data.message || 'Lỗi hệ thống'));
    }
    return transformResponse(response.data);
  },
  async (error) => {
    const originalRequest = error.config;

    const authEndpointsWithoutRefresh = new Set([
      '/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/refresh',
    ]);

    if (originalRequest.url === '/api/auth/refresh') {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !authEndpointsWithoutRefresh.has(originalRequest.url)) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return axiosClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axiosClient.post('/api/auth/refresh');
        processQueue(null);
        return axiosClient(originalRequest);
      } catch (err) {
        processQueue(err);
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
