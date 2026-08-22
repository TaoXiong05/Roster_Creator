import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { UnavailableDatesDialog } from '../components/UnavailableDatesDialog';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../utils/date';
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  bulkActionBar,
  cardBase,
  checkboxBase,
  errorText,
  tableCell,
  tableHeaderCell,
  tableHeaderRow,
  tableRow,
  tableShell,
} from '../styles/ui';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Staff[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [groupName, setGroupName] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState(false);
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<Staff | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = async (isCancelled: () => boolean = () => false) => {
    if (!id) return;
    const [memberList, staffList, groupList] = await Promise.all([
      api.groups.listMembers(id),
      api.staff.list(),
      api.groups.list(),
    ]);
    if (isCancelled()) return;
    setMembers(memberList);
    setAllStaff(staffList);
    const current = groupList.find((g) => g.id === id);
    setGroupName(current?.name ?? '');
  };

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const memberIds = new Set(members.map((m) => m.id));
  const available = allStaff.filter((s) => !memberIds.has(s.id));

  const handleAdd = async (staffId: string) => {
    if (!id) return;
    setPendingId(staffId);
    try {
      await api.groups.addMember(id, staffId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
      await load();
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    } finally {
      setPendingId(null);
    }
  };

  const toggleOne = (staffId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === available.length ? new Set() : new Set(available.map((s) => s.id))));
  };

  const handleBulkAdd = async () => {
    if (!id) return;
    setBulkAdding(true);
    setBulkError(null);
    try {
      await Promise.all([...selectedIds].map((staffId) => api.groups.addMember(id, staffId)));
      setSelectedIds(new Set());
      await load();
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t('groups.bulkAddError'));
    } finally {
      setBulkAdding(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!id || !confirmTarget) return;
    setRemoving(true);
    try {
      await api.groups.removeMember(id, confirmTarget.id);
      setConfirmTarget(null);
      await load();
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <BackLink to="/groups" label={t('groups.backToGroups')} />
        <PageHeader
          title={groupName ? t('groups.detailTitleWithName', { name: groupName }) : t('groups.detailTitle')}
          description={t('groups.detailDescription')}
        />

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">{t('groups.membersHeading')}</h2>
          {members.length === 0 ? (
            <p className="text-sm text-ink-soft">{t('groups.noMembers')}</p>
          ) : (
            <div className={tableShell}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeaderRow}>
                    <th className={tableHeaderCell}>{t('groups.nameHeader')}</th>
                    <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('groups.emailHeader')}</th>
                    <th className={`${tableHeaderCell} text-right`}>{t('groups.actionsHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tan/10">
                  {members.map((m) => {
                    const unavailableRanges = m.preference?.unavailableDateRanges ?? [];
                    return (
                      <tr key={m.id} className={tableRow}>
                        <td className={`${tableCell} text-ink`}>
                          <p>{m.name}</p>
                          {unavailableRanges.length > 0 && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {t('groups.unavailablePrefix')}{unavailableRanges.map((r) => `${formatDate(r.start)}~${formatDate(r.end)}`).join(t('common.listSeparator'))}
                            </p>
                          )}
                        </td>
                        <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{m.email}</td>
                        <td className={tableCell}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setUnavailabilityTarget(m)} className={btnSecondary}>
                              {t('groups.setUnavailableDates')}
                            </button>
                            <button onClick={() => setConfirmTarget(m)} className={btnDanger}>
                              {t('groups.remove')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">{t('groups.otherStaffHeading')}</h2>
          {available.length === 0 ? (
            <p className="text-sm text-ink-soft">{t('groups.noAvailableStaff')}</p>
          ) : (
            <div className="space-y-3">
              {selectedIds.size > 0 && (
                <div className={bulkActionBar}>
                  <span>{t('common.selectedCount', { count: selectedIds.size })}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedIds(new Set())} className={btnSecondary}>
                      {t('common.clearSelection')}
                    </button>
                    <button type="button" onClick={handleBulkAdd} disabled={bulkAdding} className={`gap-2 ${btnPrimary}`}>
                      {bulkAdding && <Spinner className="h-4 w-4" />}
                      {t('groups.bulkAddButton')}
                    </button>
                  </div>
                </div>
              )}

              {bulkError && (
                <p role="alert" className={errorText}>
                  {bulkError}
                </p>
              )}

              <div className={tableShell}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={tableHeaderRow}>
                      <th className={`${tableHeaderCell} w-10`}>
                        <input
                          type="checkbox"
                          checked={available.length > 0 && selectedIds.size === available.length}
                          onChange={toggleAll}
                          aria-label={t('common.selectAllAria')}
                          className={checkboxBase}
                        />
                      </th>
                      <th className={tableHeaderCell}>{t('groups.nameHeader')}</th>
                      <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('groups.emailHeader')}</th>
                      <th className={`${tableHeaderCell} text-right`}>{t('groups.actionsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tan/10">
                    {available.map((s) => (
                      <tr key={s.id} className={tableRow}>
                        <td className={tableCell}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleOne(s.id)}
                            aria-label={t('common.selectRowAria', { name: s.name })}
                            className={checkboxBase}
                          />
                        </td>
                        <td className={`${tableCell} text-ink`}>{s.name}</td>
                        <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{s.email}</td>
                        <td className={tableCell}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleAdd(s.id)} disabled={pendingId === s.id} className={`gap-2 ${btnSecondary}`}>
                              {pendingId === s.id && <Spinner className="h-4 w-4" />}
                              {t('groups.join')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={t('groups.removeTitle')}
        message={t('groups.removeMessage', { name: confirmTarget?.name ?? '' })}
        confirmLabel={t('groups.removeConfirmLabel')}
        loading={removing}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      <UnavailableDatesDialog
        open={!!unavailabilityTarget}
        staff={unavailabilityTarget}
        onClose={() => setUnavailabilityTarget(null)}
        onSaved={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
      />
    </AppShell>
  );
}
