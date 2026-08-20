import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';
import { formatDate } from '../utils/date';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { useLanguage } from '../i18n/LanguageContext';
import { btnDanger, btnPrimary, btnSecondary, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';

export function RosterListPage() {
  const { t } = useLanguage();
  const [rosters, setRosters] = useState<RosterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<RosterListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setRosters(await api.rosters.list());

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.rosters.remove(confirmTarget.id);
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
          title={t('rosters.listTitle')}
          description={t('rosters.listDescription')}
          action={
            <Link to="/rosters/new" className={btnPrimary}>
              {t('rosters.createRosterButton')}
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : rosters.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title={t('rosters.emptyTitle')}
            description={t('rosters.emptyDescription')}
            action={
              <Link to="/rosters/new" className={btnPrimary}>
                {t('rosters.createRosterButton')}
              </Link>
            }
          />
        ) : (
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('rosters.nameHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} sm:table-cell`}>{t('rosters.groupHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} md:table-cell`}>{t('rosters.dateRangeHeader')}</th>
                  <th className={`hidden ${tableHeaderCell} lg:table-cell`}>{t('rosters.shiftsHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('rosters.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {rosters.map((r) => (
                  <tr key={r.id} className={tableRow}>
                    <td className={tableCell}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/rosters/${r.id}`}
                          className="font-medium text-ink underline-offset-4 hover:text-coral-deep hover:underline"
                        >
                          {r.name}
                        </Link>
                        <StatusPill status={r.status} />
                      </div>
                    </td>
                    <td className={`hidden ${tableCell} text-ink-soft sm:table-cell`}>{r.groupName}</td>
                    <td className={`hidden ${tableCell} font-mono text-xs text-ink-soft md:table-cell`}>
                      {formatDate(r.dateRangeStart)} ~ {formatDate(r.dateRangeEnd)}
                    </td>
                    <td className={`hidden ${tableCell} text-ink-soft lg:table-cell`}>{r.shiftCount} {t('rosters.shiftCountSuffix')}</td>
                    <td className={tableCell}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link to={`/rosters/${r.id}/edit`} className={btnSecondary}>
                          {t('rosters.editTimePrefs')}
                        </Link>
                        <Link to={`/rosters/${r.id}`} className={btnPrimary}>
                          {t('rosters.prepareToPublish')}
                        </Link>
                        <button onClick={() => setConfirmTarget(r)} className={btnDanger}>
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
        title={t('rosters.deleteTitle')}
        message={t('rosters.deleteMessage', { name: confirmTarget?.name ?? '' })}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
