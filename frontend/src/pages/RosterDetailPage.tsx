import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail, AssignmentEntry, Staff } from '../api/client';

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

  if (!roster) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{roster.name}</h1>
          <p className="text-sm text-gray-500">
            {roster.dateRangeStart.slice(0, 10)} ~ {roster.dateRangeEnd.slice(0, 10)} · 状态：{roster.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成排班'}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="bg-blue-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={handlePublish}
            disabled={roster.status === 'published'}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            发布
          </button>
          <button onClick={handleSendAll} className="border rounded px-3 py-2 text-sm">
            发送邮件给全体
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      {emailStatus && <p className="text-sm text-green-600">{emailStatus}</p>}
      <div className="flex gap-3 text-sm">
        <a href={api.rosters.exportUrl(roster.id, 'ics')} className="underline">
          导出 ICS
        </a>
        <a href={api.rosters.exportUrl(roster.id, 'csv')} className="underline">
          导出 CSV
        </a>
        <a href={api.rosters.exportUrl(roster.id, 'pdf')} className="underline">
          导出 PDF
        </a>
      </div>
      <ul className="divide-y">
        {roster.rosterShifts.map((rs) => {
          const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
          return (
            <li key={rs.id} className="py-3 space-y-2">
              <p className="font-medium">
                {rs.date.slice(0, 10)} · {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
              </p>
              <p className="text-sm text-gray-500">
                需要 {rs.headcount} 人{rs.requiredSkills.length > 0 ? ` · 技能: ${rs.requiredSkills.join(', ')}` : ''}
              </p>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={row.staffId ?? ''}
                      onChange={(e) => updateAssignment(row.id, { staffId: e.target.value || null, unfilledTag: null })}
                      aria-label="分配员工"
                      className="border rounded px-2 py-1 text-sm flex-1"
                    >
                      <option value="">未分配</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {!row.staffId && (
                      <div className="flex gap-1 items-center flex-wrap">
                        {TAG_OPTIONS.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => updateAssignment(row.id, { unfilledTag: tag })}
                            className={`border rounded px-2 py-1 text-xs ${
                              row.unfilledTag === tag ? 'bg-blue-600 text-white' : ''
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        <input
                          placeholder="自定义标签"
                          value={row.unfilledTag && !TAG_OPTIONS.includes(row.unfilledTag) ? row.unfilledTag : ''}
                          onChange={(e) => updateAssignment(row.id, { unfilledTag: e.target.value || null })}
                          className="border rounded px-2 py-1 text-xs w-28"
                        />
                      </div>
                    )}
                    {row.staffId && (
                      <div className="flex gap-2 text-xs">
                        <button type="button" onClick={() => handleSendOne(row.staffId!)} className="underline">
                          发送给TA
                        </button>
                        <a href={api.rosters.exportUrl(roster.id, 'ics', row.staffId)} className="underline">
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
  );
}
