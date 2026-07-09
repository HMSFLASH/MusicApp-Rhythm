const DEFAULT_API_URL = 'http://localhost:8080';

type RuntimeEnv = {
  VITE_API_URL?: string;
};

declare global {
  interface Window {
    __APP_ENV__?: RuntimeEnv;
  }
}

const getBackendUrl = (): string => {
  const envUrl =
    window.__APP_ENV__?.VITE_API_URL ||
    import.meta.env.VITE_API_URL ||
    DEFAULT_API_URL;

  try {
    const url = new URL(envUrl);
    const currentHostname = window.location.hostname;
    // If the configured API URL points to localhost or 127.0.0.1, but the browser
    // is accessing the frontend via a LAN IP or another domain, we dynamically
    // redirect the API calls to the same host on the configured backend port.
    if (
      currentHostname &&
      currentHostname !== 'localhost' &&
      currentHostname !== '127.0.0.1' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      url.hostname = currentHostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch (e) {
    return envUrl;
  }
};

export const BACKEND_URL = getBackendUrl();
