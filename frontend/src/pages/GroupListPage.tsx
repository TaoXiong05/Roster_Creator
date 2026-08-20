import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, StaffGroup } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';

export function GroupListPage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<StaffGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setGroups(await api.groups.list());

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.groups.create(name);
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const next = window.prompt(t('groups.renamePrompt'), currentName);
    if (!next) return;
    await api.groups.rename(id, next);
    await load();
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.groups.remove(confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <PageHeader title={t('groups.listTitle')} description={t('groups.listDescription')} />

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row sm:items-end`}>
          <div className="sm:flex-1">
            <label htmlFor="group-name" className={labelBase}>
              {t('groups.groupNameLabel')}
            </label>
            <input
              id="group-name"
              placeholder={t('groups.groupNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            {t('groups.createGroupButton')}
          </button>
        </form>

        {loading ? (
          <PageSkeleton rows={3} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title={t('groups.emptyTitle')}
            description={t('groups.emptyDescription')}
          />
        ) : (
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('groups.groupNameHeader')}</th>
                  <th className={tableHeaderCell}>{t('groups.memberCountHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('groups.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {groups.map((g) => (
                  <tr key={g.id} className={tableRow}>
                    <td className={`${tableCell} font-medium text-ink`}>{g.name}</td>
                    <td className={`${tableCell} text-ink-soft`}>
                      {g.memberCount} {t('groups.memberCountSuffix')}
                    </td>
                    <td className={tableCell}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link to={`/groups/${g.id}`} className={btnSecondary}>
                          {t('groups.manageMembers')}
                        </Link>
                        <button onClick={() => handleRename(g.id, g.name)} className={btnSecondary}>
                          {t('groups.rename')}
                        </button>
                        <button onClick={() => setConfirmTarget(g)} className={btnDanger}>
                          {t('groups.delete')}
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
        title={t('groups.deleteTitle')}
        message={t('groups.deleteMessage', { name: confirmTarget?.name ?? '' })}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
