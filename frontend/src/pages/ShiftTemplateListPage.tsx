import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { TimeInput } from '../components/TimeInput';
import { useLanguage } from '../i18n/LanguageContext';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';

export function ShiftTemplateListPage() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ShiftTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => setTemplates(await api.shiftTemplates.list());

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
      await api.shiftTemplates.create({ name, startTime, endTime });
      setName('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.shiftTemplates.remove(confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (t: ShiftTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditStart(t.startTime);
    setEditEnd(t.endTime);
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSavingEdit(true);
    try {
      await api.shiftTemplates.update(editingId, { name: editName, startTime: editStart, endTime: editEnd });
      setEditingId(null);
      await load();
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <PageHeader title={t('shiftTemplates.title')} description={t('shiftTemplates.description')} />

        <form onSubmit={handleCreate} className={`${cardBase} space-y-3`}>
          <div>
            <label htmlFor="template-name" className={labelBase}>
              {t('shiftTemplates.templateNameLabel')}
            </label>
            <input
              id="template-name"
              placeholder={t('shiftTemplates.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-40">
              <label htmlFor="template-start" className={labelBase}>
                {t('shiftTemplates.startTimeLabel')}
              </label>
              <TimeInput id="template-start" value={startTime} onChange={setStartTime} placeholder={t('shiftTemplates.timeExample')} required />
            </div>
            <div className="sm:w-40">
              <label htmlFor="template-end" className={labelBase}>
                {t('shiftTemplates.endTimeLabel')}
              </label>
              <TimeInput id="template-end" value={endTime} onChange={setEndTime} placeholder={t('shiftTemplates.timeExampleEnd')} required />
            </div>
            <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
              {creating && <Spinner className="h-4 w-4" />}
              {t('shiftTemplates.addButton')}
            </button>
          </div>
          <p className="text-xs text-ink-soft">{t('shiftTemplates.hint')}</p>
        </form>

        {loading ? (
          <PageSkeleton rows={3} />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title={t('shiftTemplates.emptyTitle')}
            description={t('shiftTemplates.emptyDescription')}
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">{t('shiftTemplates.nameHeader')}</th>
                  <th className="px-5 py-3">{t('shiftTemplates.startHeader')}</th>
                  <th className="px-5 py-3">{t('shiftTemplates.endHeader')}</th>
                  <th className="px-5 py-3 text-right">{t('shiftTemplates.actionsHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {templates.map((tpl) =>
                  editingId === tpl.id ? (
                    <tr key={tpl.id} className="bg-sand/60">
                      <td colSpan={4} className="px-5 py-4">
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <div>
                            <label htmlFor={`edit-name-${tpl.id}`} className={labelBase}>
                              {t('shiftTemplates.templateNameLabel')}
                            </label>
                            <input
                              id={`edit-name-${tpl.id}`}
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={inputBase}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="sm:w-40">
                              <label htmlFor={`edit-start-${tpl.id}`} className={labelBase}>
                                {t('shiftTemplates.startTimeLabel')}
                              </label>
                              <TimeInput id={`edit-start-${tpl.id}`} value={editStart} onChange={setEditStart} placeholder={t('shiftTemplates.timeExample')} required />
                            </div>
                            <div className="sm:w-40">
                              <label htmlFor={`edit-end-${tpl.id}`} className={labelBase}>
                                {t('shiftTemplates.endTimeLabel')}
                              </label>
                              <TimeInput id={`edit-end-${tpl.id}`} value={editEnd} onChange={setEditEnd} placeholder={t('shiftTemplates.timeExampleEnd')} required />
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
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={tpl.id} className="transition-colors hover:bg-sand/70">
                      <td className="px-5 py-3 font-medium text-ink">{tpl.name}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{tpl.startTime}</td>
                      <td className="px-5 py-3 font-mono text-ink-soft">{tpl.endTime}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(tpl)} className={btnSecondary}>
                            {t('common.edit')}
                          </button>
                          <button onClick={() => setConfirmTarget(tpl)} className={btnDanger}>
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
        title={t('shiftTemplates.deleteTitle')}
        message={t('shiftTemplates.deleteMessage', { name: confirmTarget?.name ?? '' })}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
