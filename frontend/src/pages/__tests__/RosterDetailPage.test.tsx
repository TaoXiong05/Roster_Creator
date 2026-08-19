import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterDetailPage } from '../RosterDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    rosters: {
      get: vi.fn(),
      generateAssignments: vi.fn(),
      saveAssignments: vi.fn(),
      publish: vi.fn(),
      sendEmails: vi.fn(),
      exportUrl: vi.fn((id: string, format: string, staffId?: string) =>
        `/api/rosters/${id}/export/${format}${staffId ? `?staffId=${staffId}` : ''}`
      ),
    },
    groups: { listMembers: vi.fn() },
  },
}));

const baseRoster = {
  id: 'roster-1',
  name: 'Week 34',
  dateRangeStart: '2026-08-17T00:00:00.000Z',
  dateRangeEnd: '2026-08-23T00:00:00.000Z',
  groupId: 'group-1',
  status: 'draft',
  rosterShifts: [
    {
      id: 'rs-1',
      date: '2026-08-17T00:00:00.000Z',
      headcount: 1,
      requiredSkills: [],
      shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null }],
    },
  ],
};

describe('RosterDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('generates assignments via the AI and shows the result', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', preference: null }]);
    (api.rosters.generateAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '生成排班' }));

    await waitFor(() => expect(api.rosters.generateAssignments).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
  });

  it('disables save until an edit is made, then saves the local changes', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', preference: null }]);
    (api.rosters.saveAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('分配员工'), 'staff-1');
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(api.rosters.saveAssignments).toHaveBeenCalledWith('roster-1', [
        { id: 'a-1', staffId: 'staff-1', unfilledTag: null },
      ])
    );
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('lets the user tag an unfilled slot', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'AGENT' }));

    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
  });
});

describe('RosterDetailPage publish and email actions', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('publishes the roster', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.publish as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => expect(api.rosters.publish).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText('已发布')).toBeInTheDocument());
  });

  it('sends emails to everyone assigned', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.sendEmails as any).mockResolvedValue({ sentTo: ['a@b.com'] });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '发送邮件给全体' }));

    await waitFor(() => expect(api.rosters.sendEmails).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText(/已发送给 1 位员工/)).toBeInTheDocument());
  });
});
