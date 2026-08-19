import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageSkeleton } from '../components/Skeleton';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, btnDanger, btnSecondary } from '../styles/ui';

export function StaffListPage() {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('staff.nameHeader')}</th>
                  <th className="hidden px-5 py-3 sm:table-cell">{t('staff.emailHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('staff.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {staff.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                    <td className="hidden px-5 py-3 text-ink-soft sm:table-cell">{s.email}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/staff/${s.id}`} className={btnSecondary}>
                          {t('common.edit')}
                        </Link>
                        <button onClick={() => setConfirmTarget(s)} className={btnDanger}>
                          {t('common.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </AppShell>
  );
}
