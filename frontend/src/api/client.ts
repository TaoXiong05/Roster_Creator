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

export interface Preference {
  id: string;
  staffId: string;
  preferredShiftTemplateIds: string[];
  unavailableDateRanges: { start: string; end: string }[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredWeekdays: number[];
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  skills: string[];
  preference: Preference | null;
}

export interface StaffGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface PreferenceInput {
  preferredShiftTemplateIds: string[];
  unavailableDateRanges: { start: string; end: string }[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredWeekdays: number[];
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
  staff: {
    list: () => apiRequest<Staff[]>('/staff'),
    get: (id: string) => apiRequest<Staff>(`/staff/${id}`),
    create: (data: { name: string; email: string; skills: string[] }) =>
      apiRequest<Staff>('/staff', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; email: string; skills: string[] }) =>
      apiRequest<Staff>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => apiRequest<void>(`/staff/${id}`, { method: 'DELETE' }),
    updatePreference: (id: string, data: PreferenceInput) =>
      apiRequest<Preference>(`/staff/${id}/preference`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  groups: {
    list: () => apiRequest<StaffGroup[]>('/groups'),
    create: (name: string) => apiRequest<StaffGroup>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    rename: (id: string, name: string) =>
      apiRequest<StaffGroup>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    remove: (id: string) => apiRequest<void>(`/groups/${id}`, { method: 'DELETE' }),
    listMembers: (id: string) => apiRequest<Staff[]>(`/groups/${id}/members`),
    addMember: (id: string, staffId: string) =>
      apiRequest<void>(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ staffId }) }),
    removeMember: (id: string, staffId: string) =>
      apiRequest<void>(`/groups/${id}/members/${staffId}`, { method: 'DELETE' }),
  },
};
