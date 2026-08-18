// frontend/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface ApiError {
  error: string;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw new Error(body.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
}

export const api = {
  register: (email: string, password: string) =>
    apiRequest<User>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    apiRequest<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<User>('/auth/me'),
  requestPasswordReset: (email: string) =>
    apiRequest<void>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token: string, password: string) =>
    apiRequest<void>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),
};
