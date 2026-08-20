import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageSkeleton } from '../components/Skeleton';
import { UnavailableDatesDialog } from '../components/UnavailableDatesDialog';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../utils/date';
import {
  btnPrimary,
  btnDanger,
  btnSecondary,
  bulkActionBar,
  checkboxBase,
  errorText,
  tableShell,
  tableHeaderRow,
  tableHeaderCell,
  tableCell,
  tableRow,
} from '../styles/ui';

export function StaffListPage() {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<Staff | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkTargetCount, setBulkTargetCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      setStaff(await api.staff.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.staff.remove(confirmTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(confirmTarget.id);
        return next;
      });
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === staff.length ? new Set() : new Set(staff.map((s) => s.id))));
  };

  const openBulkConfirm = () => {
    setBulkTargetCount(selectedIds.size);
    setBulkError(null);
    setBulkConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setBulkError(null);
    try {
      await Promise.all([...selectedIds].map((id) => api.staff.remove(id)));
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t('staff.bulkDeleteError'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const allSelected = staff.length > 0 && selectedIds.size === staff.length;

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <PageHeader
          title={t('staff.listTitle')}
          description={t('staff.listDescription')}
          action={
            <Link to="/staff/new" className={btnPrimary}>
              {t('staff.createButton')}
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title={t('staff.emptyTitle')}
            description={t('staff.emptyDescription')}
            action={
              <Link to="/staff/new" className={btnPrimary}>
                {t('staff.createButton')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {selectedIds.size > 0 && (
              <div className={bulkActionBar}>
                <span>{t('common.selectedCount', { count: selectedIds.size })}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedIds(new Set())} className={btnSecondary}>
                    {t('common.clearSelection')}
                  </button>
                  <button type="button" onClick={openBulkConfirm} className={btnDanger}>
                    {t('staff.bulkDeleteButton')}
                  </button>
                </div>
              </div>
            )}

            <div className={tableShell}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeaderRow}>
                    <th className={`${tableHeaderCell} w-10`}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label={t('common.selectAllAria')}
                        className={checkboxBase}
                      />
                    </th>
                    <th className={tableHeaderCell}>{t('staff.nameHeader')}</th>
                    <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('staff.emailHeader')}</th>
                    <th className={`${tableHeaderCell} text-right`}>{t('staff.actionsHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tan/10">
                  {staff.map((s) => {
                    const unavailableRanges = s.preference?.unavailableDateRanges ?? [];
                    return (
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
                        <td className={`${tableCell} font-medium text-ink`}>
                          <p>{s.name}</p>
                          {unavailableRanges.length > 0 && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {t('staff.unavailablePrefix')}
                              {unavailableRanges.map((r) => `${formatDate(r.start)}~${formatDate(r.end)}`).join(t('common.listSeparator'))}
                            </p>
                          )}
                        </td>
                        <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{s.email}</td>
                        <td className={tableCell}>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setUnavailabilityTarget(s)} className={btnSecondary}>
                              {t('staff.setUnavailableDates')}
                            </button>
                            <Link to={`/staff/${s.id}`} className={btnSecondary}>
                              {t('common.edit')}
                            </Link>
                            <button onClick={() => setConfirmTarget(s)} className={btnDanger}>
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={t('staff.deleteTitle')}
        message={t('staff.deleteMessage', { name: confirmTarget?.name ?? '' })}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={t('staff.deleteTitle')}
        message={t('staff.bulkDeleteMessage', { count: bulkTargetCount })}
        loading={bulkDeleting}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
      />

      {bulkError && (
        <p role="alert" className={`fixed bottom-6 right-6 z-40 ${errorText}`}>
          {bulkError}
        </p>
      )}

      <UnavailableDatesDialog
        open={!!unavailabilityTarget}
        staff={unavailabilityTarget}
        onClose={() => setUnavailabilityTarget(null)}
        onSaved={(updated) => setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
      />
    </AppShell>
  );
}
