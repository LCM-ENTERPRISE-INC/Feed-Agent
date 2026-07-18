import axios from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Standard response wrapper type for Feed-Agent API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Injects active JWT session bearer tokens automatically
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const sessionToken = localStorage.getItem('feedagent-session');
    if (sessionToken && config.headers) {
      config.headers.Authorization = `Bearer ${sessionToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catches 401 Unauthorized token expirations and forces clean redirect
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // If unauthorized (expired or malformed token), clear storage session and send to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('feedagent-session');
      // Only redirect if not already on the login page to avoid loops
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
