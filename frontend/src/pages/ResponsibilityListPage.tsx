import { useState, FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Responsibility } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, tableShell, tableHeaderRow, tableHeaderCell, tableCell, tableRow } from '../styles/ui';

export function ResponsibilityListPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: responsibilities = [], isLoading } = useQuery({
    queryKey: ['responsibilities'],
    queryFn: () => api.responsibilities.list(),
  });
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Responsibility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.responsibilities.create(name);
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['responsibilities'] });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.responsibilities.remove(confirmTarget.id);
      setConfirmTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['responsibilities'] });
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (r: Responsibility) => {
    setEditingId(r.id);
    setEditName(r.name);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await api.responsibilities.update(editingId, editName);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['responsibilities'] });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <PageHeader title={t('responsibilities.title')} description={t('responsibilities.description')} />

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row sm:items-end`}>
          <div className="sm:flex-1">
            <label htmlFor="responsibility-name" className={labelBase}>
              {t('responsibilities.nameLabel')}
            </label>
            <input
              id="responsibility-name"
              placeholder={t('responsibilities.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            {t('responsibilities.addButton')}
          </button>
        </form>

        {isLoading ? (
          <PageSkeleton rows={3} />
        ) : responsibilities.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title={t('responsibilities.emptyTitle')}
            description={t('responsibilities.emptyDescription')}
          />
        ) : (
          <div className={tableShell}>
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeaderRow}>
                  <th className={tableHeaderCell}>{t('responsibilities.nameHeader')}</th>
                  <th className={`${tableHeaderCell} text-right`}>{t('responsibilities.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {responsibilities.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="bg-sand/60">
                      <td colSpan={2} className="px-5 py-4">
                        <form onSubmit={handleSaveEdit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="sm:flex-1">
                            <label htmlFor={`edit-responsibility-${r.id}`} className={labelBase}>
                              {t('responsibilities.nameLabel')}
                            </label>
                            <input
                              id={`edit-responsibility-${r.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={inputBase}
                              required
                            />
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="submit" disabled={savingEdit} className={`gap-2 ${btnPrimary}`}>
                              {savingEdit && <Spinner className="h-4 w-4" />}
                              {t('common.save')}
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className={btnSecondary}>
                              {t('common.cancel')}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className={tableRow}>
                      <td className={`${tableCell} font-medium text-ink`}>{r.name}</td>
                      <td className={tableCell}>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(r)} className={btnSecondary}>
                            {t('common.edit')}
                          </button>
                          <button onClick={() => setConfirmTarget(r)} className={btnDanger}>
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={t('responsibilities.deleteTitle')}
        message={t('responsibilities.deleteMessage', { name: confirmTarget?.name ?? '' })}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
