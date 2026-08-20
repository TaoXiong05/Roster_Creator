import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail, AssignmentEntry, Responsibility, Staff } from '../api/client';
import { formatDate } from '../utils/date';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { StatusPill } from '../components/StatusPill';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, btnSecondary, errorText, inputBase, successText, tableShell } from '../styles/ui';

const TAG_OPTIONS = ['AGENT', 'PICKUP'];

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [roster, setRoster] = useState<RosterDetail | null>(null);
  const [members, setMembers] = useState<Staff[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingStaffId, setSendingStaffId] = useState<string | null>(null);
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
    api.responsibilities.list().then(setResponsibilities);
  }, []);

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
      setError(err instanceof Error ? err.message : t('rosters.aiFailedError'));
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
    setSaving(true);
    try {
      const result = await api.rosters.saveAssignments(
        id,
        assignments.map((a) => ({ id: a.id, staffId: a.staffId, unfilledTag: a.unfilledTag }))
      );
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setPublishing(true);
    try {
      const updated = await api.rosters.publish(id);
      setRoster((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } finally {
      setPublishing(false);
    }
  };

  const handleSendAll = async () => {
    if (!id) return;
    setEmailStatus(null);
    setSendingAll(true);
    try {
      const result = await api.rosters.sendEmails(id);
      setEmailStatus(t('rosters.sentToCount', { count: result.sentTo.length }));
    } finally {
      setSendingAll(false);
    }
  };

  const handleSendOne = async (staffId: string) => {
    if (!id) return;
    setEmailStatus(null);
    setSendingStaffId(staffId);
    try {
      const result = await api.rosters.sendEmails(id, [staffId]);
      setEmailStatus(t('rosters.sentToCount', { count: result.sentTo.length }));
    } finally {
      setSendingStaffId(null);
    }
  };

  if (!roster)
    return (
      <AppShell width="wide">
        <PageSkeleton rows={5} />
      </AppShell>
    );

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <BackLink to="/rosters" label={t('rosters.backToRosters')} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink">{roster.name}</h1>
              <StatusPill status={roster.status} />
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              {formatDate(roster.dateRangeStart)} ~ {formatDate(roster.dateRangeEnd)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleGenerate} disabled={generating} className={`gap-2 ${btnSecondary}`}>
              {generating && <Spinner className="h-4 w-4" />}
              {generating ? t('rosters.generating') : t('rosters.generateButton')}
            </button>
            <button type="button" onClick={handleSave} disabled={!dirty || saving} className={`gap-2 ${btnPrimary}`}>
              {saving && <Spinner className="h-4 w-4" />}
              {t('rosters.saveButton')}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={roster.status === 'published' || publishing}
              className={`gap-2 ${btnSecondary}`}
            >
              {publishing && <Spinner className="h-4 w-4" />}
              {t('rosters.publishButton')}
            </button>
            <button type="button" onClick={handleSendAll} disabled={sendingAll} className={`gap-2 ${btnSecondary}`}>
              {sendingAll && <Spinner className="h-4 w-4" />}
              {t('rosters.sendAllButton')}
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
            {t('rosters.exportIcs')}
          </a>
          <a href={api.rosters.exportUrl(roster.id, 'csv')} className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {t('rosters.exportCsv')}
          </a>
          <a href={api.rosters.exportUrl(roster.id, 'pdf')} className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {t('rosters.exportPdf')}
          </a>
        </div>

        <div className={tableShell}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-tan/10">
              {roster.rosterShifts.map((rs) => {
                const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
                return (
                  <Fragment key={rs.id}>
                    <tr className="bg-sand/60">
                      <td className="whitespace-nowrap px-5 py-3 align-top font-mono text-xs text-ink-soft">
                        {formatDate(rs.date)}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">
                          {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
                        </p>
                        <p className="text-xs text-ink-soft">
                          {t('rosters.headcountLabel', {
                            count: rs.headcount,
                            responsibility: responsibilities.find((r) => r.id === rs.responsibilityId)?.name ?? t('rosters.unknownResponsibility'),
                          })}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-medium text-ink-soft">{rows.length} {t('rosters.slotsSuffix')}</span>
                      </td>
                    </tr>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-tan/10">
                        <td colSpan={3} className="px-5 py-3">
                          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                            <select
                              value={row.staffId ?? ''}
                              onChange={(e) => updateAssignment(row.id, { staffId: e.target.value || null, unfilledTag: null })}
                              aria-label={t('rosters.assignStaffAria')}
                              className={`${inputBase} lg:w-64 lg:shrink-0`}
                            >
                              <option value="">{t('rosters.unassigned')}</option>
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
                                  placeholder={t('rosters.customTagPlaceholder')}
                                  value={row.unfilledTag && !TAG_OPTIONS.includes(row.unfilledTag) ? row.unfilledTag : ''}
                                  onChange={(e) => updateAssignment(row.id, { unfilledTag: e.target.value || null })}
                                  className="w-32 rounded-full border border-tan/30 bg-white/70 px-3 py-1 text-xs text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30"
                                />
                              </div>
                            )}
                            {row.staffId && (
                              <div className="flex shrink-0 items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleSendOne(row.staffId!)}
                                  disabled={sendingStaffId === row.staffId}
                                  className="inline-flex items-center gap-1.5 font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline disabled:no-underline disabled:opacity-60"
                                >
                                  {sendingStaffId === row.staffId && <Spinner className="h-3.5 w-3.5" />}
                                  {t('rosters.sendToThem')}
                                </button>
                                <a href={api.rosters.exportUrl(roster.id, 'ics', row.staffId)} className="font-medium text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
                                  {t('rosters.personalIcs')}
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
