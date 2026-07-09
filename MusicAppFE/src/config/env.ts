const DEFAULT_API_URL = 'http://localhost:8080';

type RuntimeEnv = {
  VITE_API_URL?: string;
};

declare global {
  interface Window {
    __APP_ENV__?: RuntimeEnv;
  }
}

export const BACKEND_URL =
  window.__APP_ENV__?.VITE_API_URL ||
  import.meta.env.VITE_API_URL ||
  DEFAULT_API_URL;
