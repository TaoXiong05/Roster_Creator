// frontend/src/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../client';

describe('api.login', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts credentials and returns the user on success', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user-1', email: 'a@b.com' }),
    });

    const user = await api.login('a@b.com', 'password123');

    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('throws the server error message on failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});

describe('api.staff', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('lists staff', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    await api.staff.list();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/staff'), expect.objectContaining({ credentials: 'include' }));
  });

  it('creates staff', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'staff-1' }) });
    await api.staff.create({ name: 'Alice', email: 'a@b.com', skills: [] });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/staff'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.groups', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('adds a member', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    await api.groups.addMember('group-1', 'staff-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/groups/group-1/members'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.shiftTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates a shift template', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'template-1' }) });
    await api.shiftTemplates.create({ name: 'Morning', startTime: '06:00', endTime: '14:00' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/shift-templates'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.rosters', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates a roster', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'roster-1' }) });
    await api.rosters.create({
      name: 'Week 34',
      dateRangeStart: '2026-08-17',
      dateRangeEnd: '2026-08-23',
      groupId: 'group-1',
      shifts: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.rosters assignment methods', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('generates assignments', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignments: [] }) });
    await api.rosters.generateAssignments('roster-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/generate-assignments'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('saves assignments', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignments: [] }) });
    await api.rosters.saveAssignments('roster-1', [{ id: 'a-1', staffId: null, unfilledTag: 'AGENT' }]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/assignments'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});

describe('api.rosters publish/export/email', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('publishes a roster', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'roster-1', status: 'published' }) });
    await api.rosters.publish('roster-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/publish'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('sends emails with the given staffIds', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ sentTo: [] }) });
    await api.rosters.sendEmails('roster-1', ['staff-1']);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/send-emails'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ staffIds: ['staff-1'] }) })
    );
  });

  it('builds an export url scoped to a staff member', () => {
    const url = api.rosters.exportUrl('roster-1', 'ics', 'staff-1');
    expect(url).toContain('/rosters/roster-1/export/ics');
    expect(url).toContain('staffId=staff-1');
  });

  it('builds a whole-roster export url without a staffId', () => {
    const url = api.rosters.exportUrl('roster-1', 'csv');
    expect(url).toBe(`${url.split('/rosters')[0]}/rosters/roster-1/export/csv`);
  });
});
