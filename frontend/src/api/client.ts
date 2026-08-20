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
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface User {
  id: string;
  email: string;
}

export interface PreferredShift {
  weekday: number;
  shiftTemplateId: string;
}

export type HoursPeriod = 'weekly' | 'fortnightly' | 'monthly';
export type HoursUnit = 'hours' | 'shifts';

export interface Preference {
  id: string;
  staffId: string;
  preferredShifts: PreferredShift[];
  unavailableShifts: PreferredShift[];
  unavailableDateRanges: { start: string; end: string }[];
  minHours: number;
  maxHours: number;
  hoursPeriod: HoursPeriod;
  hoursUnit: HoursUnit;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  responsibilityIds: string[];
  preference: Preference | null;
}

export interface StaffGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface Responsibility {
  id: string;
  name: string;
}

export interface RosterShiftRequirement {
  responsibilityId: string;
  headcount: number;
}

export interface RosterShiftInput {
  shiftTemplateId: string;
  dates: string[];
  requirements: RosterShiftRequirement[];
}

export interface RosterListItem {
  id: string;
  name: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  groupId: string;
  groupName: string;
  status: string;
  shiftCount: number;
}

export interface AssignmentEntry {
  id: string;
  rosterShiftId: string;
  staffId: string | null;
  unfilledTag: string | null;
  staff: { id: string; name: string; email: string } | null;
}

export interface RosterShift {
  id: string;
  date: string;
  headcount: number;
  responsibilityId: string;
  shiftTemplate: ShiftTemplate;
  assignments: AssignmentEntry[];
}

export interface RosterDetail {
  id: string;
  name: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  groupId: string;
  status: string;
  hoursPerShift: number;
  rosterShifts: RosterShift[];
}

export interface PreferenceInput {
  preferredShifts: PreferredShift[];
  unavailableShifts: PreferredShift[];
  unavailableDateRanges: { start: string; end: string }[];
  minHours: number;
  maxHours: number;
  hoursPeriod: HoursPeriod;
  hoursUnit: HoursUnit;
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
    create: (data: { name: string; email: string; responsibilityIds: string[] }) =>
      apiRequest<Staff>('/staff', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; email: string; responsibilityIds: string[] }) =>
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
  shiftTemplates: {
    list: () => apiRequest<ShiftTemplate[]>('/shift-templates'),
    create: (data: { name: string; startTime: string; endTime: string }) =>
      apiRequest<ShiftTemplate>('/shift-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; startTime: string; endTime: string }) =>
      apiRequest<ShiftTemplate>(`/shift-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => apiRequest<void>(`/shift-templates/${id}`, { method: 'DELETE' }),
  },
  responsibilities: {
    list: () => apiRequest<Responsibility[]>('/responsibilities'),
    create: (name: string) => apiRequest<Responsibility>('/responsibilities', { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id: string, name: string) =>
      apiRequest<Responsibility>(`/responsibilities/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    remove: (id: string) => apiRequest<void>(`/responsibilities/${id}`, { method: 'DELETE' }),
  },
  rosters: {
    list: () => apiRequest<RosterListItem[]>('/rosters'),
    get: (id: string) => apiRequest<RosterDetail>(`/rosters/${id}`),
    create: (data: {
      name: string;
      dateRangeStart: string;
      dateRangeEnd: string;
      groupId: string;
      hoursPerShift: number;
      shifts: RosterShiftInput[];
    }) => apiRequest<RosterDetail>('/rosters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: {
      name: string;
      dateRangeStart: string;
      dateRangeEnd: string;
      groupId: string;
      hoursPerShift: number;
      shifts: RosterShiftInput[];
    }) => apiRequest<RosterDetail>(`/rosters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    generateAssignments: (id: string) =>
      apiRequest<{ assignments: AssignmentEntry[]; status: string }>(`/rosters/${id}/generate-assignments`, {
        method: 'POST',
      }),
    saveAssignments: (id: string, assignments: { id: string; staffId: string | null; unfilledTag: string | null }[]) =>
      apiRequest<{ assignments: AssignmentEntry[] }>(`/rosters/${id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ assignments }),
      }),
    publish: (id: string) => apiRequest<{ id: string; status: string }>(`/rosters/${id}/publish`, { method: 'PUT' }),
    sendEmails: (id: string, staffIds?: string[]) =>
      apiRequest<{ sentTo: string[]; failed: string[] }>(`/rosters/${id}/send-emails`, {
        method: 'POST',
        body: JSON.stringify({ staffIds }),
      }),
    exportUrl: (id: string, format: 'ics' | 'csv' | 'pdf', staffId?: string): string => {
      const base = `${API_BASE}/rosters/${id}/export/${format}`;
      return staffId ? `${base}?staffId=${staffId}` : base;
    },
    remove: (id: string) => apiRequest<void>(`/rosters/${id}`, { method: 'DELETE' }),
  },
};
