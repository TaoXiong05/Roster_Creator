import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail, AssignmentEntry, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { StatusPill } from '../components/StatusPill';
import { btnPrimary, btnSecondary, cardBase, errorText, inputBase, successText } from '../styles/ui';

const TAG_OPTIONS = ['AGENT', 'PICKUP'];

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterDetail | null>(null);
  const [members, setMembers] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const loadRoster = async () => {
    if (!id) return;
    const r = await api.rosters.get(id);
    setRoster(r);
    setAssignments(r.rosterShifts.flatMap((rs) => rs.assignments));
    const groupMembers = await api.groups.listMembers(r.groupId);
    setMembers(groupMembers);
    setDirty(false);
  };

  useEffect(() => {
    loadRoster();
  }, [id]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleGenerate = async () => {
    if (!id) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await api.rosters.generateAssignments(id);
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 分配失败，请重试或手动排班');
    } finally {
      setGenerating(false);
    }
  };

  const updateAssignment = (assignmentId: string, patch: Partial<AssignmentEntry>) => {
    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    try {
      const result = await api.rosters.saveAssignments(
        id,
        assignments.map((a) => ({ id: a.id, staffId: a.staffId, unfilledTag: a.unfilledTag }))
      );
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    const updated = await api.rosters.publish(id);
    setRoster((prev) => (prev ? { ...prev, status: updated.status } : prev));
  };

  const handleSendAll = async () => {
    if (!id) return;
    setEmailStatus(null);
    const result = await api.rosters.sendEmails(id);
    setEmailStatus(`已发送给 ${result.sentTo.length} 位员工`);
  };

  const handleSendOne = async (staffId: string) => {
    if (!id) return;
    setEmailStatus(null);
    const result = await api.rosters.sendEmails(id, [staffId]);
    setEmailStatus(`已发送给 ${result.sentTo.length} 位员工`);
  };

  if (!roster)
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">加载中...</p>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink">{roster.name}</h1>
              <StatusPill status={roster.status} />
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {roster.dateRangeStart.slice(0, 10)} ~ {roster.dateRangeEnd.slice(0, 10)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleGenerate} disabled={generating} className={btnSecondary}>
              {generating ? '生成中...' : '生成排班'}
            </button>
            <button type="button" onClick={handleSave} disabled={!dirty} className={btnPrimary}>
              保存
            </button>
            <button type="button" onClick={handlePublish} disabled={roster.status === 'published'} className={btnSecondary}>
              发布
            </button>
            <button type="button" onClick={handleSendAll} className={btnSecondary}>
              发送邮件给全体
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}
        {emailStatus && <p className={successText}>{emailStatus}</p>}

        <div className="flex flex-wrap gap-4 text-sm">
          <a href={api.rosters.exportUrl(roster.id, 'ics')} className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            导出 ICS
          </a>
          <a href={api.rosters.exportUrl(roster.id, 'csv')} className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            导出 CSV
          </a>
          <a href={api.rosters.exportUrl(roster.id, 'pdf')} className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            导出 PDF
          </a>
        </div>

        <ul className="space-y-4">
          {roster.rosterShifts.map((rs) => {
            const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
            return (
              <li key={rs.id} className={`${cardBase} space-y-3`}>
                <div>
                  <p className="font-medium text-ink">
                    {rs.date.slice(0, 10)} · {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
                  </p>
                  <p className="text-sm text-ink-soft">
                    需要 {rs.headcount} 人{rs.requiredSkills.length > 0 ? ` · 技能: ${rs.requiredSkills.join(', ')}` : ''}
                  </p>
                </div>
                <div className="space-y-2">
                  {rows.map((row) => (
                    <div key={row.id} className="flex flex-col gap-2 rounded-2xl border border-tan/15 bg-white/60 p-3 sm:flex-row sm:items-center">
                      <select
                        value={row.staffId ?? ''}
                        onChange={(e) => updateAssignment(row.id, { staffId: e.target.value || null, unfilledTag: null })}
                        aria-label="分配员工"
                        className={`${inputBase} sm:flex-1`}
                      >
                        <option value="">未分配</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {!row.staffId && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {TAG_OPTIONS.map((tag) => (
                            <button
                              type="button"
                              key={tag}
                              onClick={() => updateAssignment(row.id, { unfilledTag: tag })}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                row.unfilledTag === tag
                                  ? 'border-coral-deep bg-coral-deep text-white'
                                  : 'border-tan/30 bg-white/70 text-ink-soft hover:border-coral/40'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                          <input
                            placeholder="自定义标签"
                            value={row.unfilledTag && !TAG_OPTIONS.includes(row.unfilledTag) ? row.unfilledTag : ''}
                            onChange={(e) => updateAssignment(row.id, { unfilledTag: e.target.value || null })}
                            className="w-28 rounded-full border border-tan/30 bg-white/70 px-3 py-1 text-xs text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30"
                          />
                        </div>
                      )}
                      {row.staffId && (
                        <div className="flex shrink-0 gap-3 text-xs">
                          <button type="button" onClick={() => handleSendOne(row.staffId!)} className="font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
                            发送给TA
                          </button>
                          <a href={api.rosters.exportUrl(roster.id, 'ics', row.staffId)} className="font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
                            个人ICS
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
