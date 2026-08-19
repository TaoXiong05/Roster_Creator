import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftTemplate } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, listRow } from '../styles/ui';

export function ShiftTemplateListPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
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
    load();
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
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="班次模板" description="设定好上下班时间，随时复用" />

        <form onSubmit={handleCreate} className={`${cardBase} space-y-3`}>
          <div>
            <label htmlFor="template-name" className={labelBase}>
              模板名称
            </label>
            <input
              id="template-name"
              placeholder="名称（如：早班）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-40">
              <label htmlFor="template-start" className={labelBase}>
                开始时间
              </label>
              <input
                id="template-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputBase}
                required
              />
            </div>
            <div className="sm:w-40">
              <label htmlFor="template-end" className={labelBase}>
                结束时间
              </label>
              <input
                id="template-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputBase}
                required
              />
            </div>
            <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
              {creating && <Spinner className="h-4 w-4" />}
              添加模板
            </button>
          </div>
        </form>

        {templates.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有班次模板，先在上面添加一个吧。</p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) =>
              editingId === t.id ? (
                <li key={t.id} className={`${cardBase} space-y-3`}>
                  <form onSubmit={handleSaveEdit} className="space-y-3">
                    <div>
                      <label htmlFor={`edit-name-${t.id}`} className={labelBase}>
                        模板名称
                      </label>
                      <input
                        id={`edit-name-${t.id}`}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputBase}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="sm:w-40">
                        <label htmlFor={`edit-start-${t.id}`} className={labelBase}>
                          开始时间
                        </label>
                        <input
                          id={`edit-start-${t.id}`}
                          type="time"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className={inputBase}
                          required
                        />
                      </div>
                      <div className="sm:w-40">
                        <label htmlFor={`edit-end-${t.id}`} className={labelBase}>
                          结束时间
                        </label>
                        <input
                          id={`edit-end-${t.id}`}
                          type="time"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          className={inputBase}
                          required
                        />
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="submit" disabled={savingEdit} className={`gap-2 ${btnPrimary}`}>
                          {savingEdit && <Spinner className="h-4 w-4" />}
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={btnSecondary}>
                          取消
                        </button>
                      </div>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={t.id} className={listRow}>
                  <span className="font-medium text-ink">
                    {t.name}（{t.startTime} - {t.endTime}）
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => startEdit(t)} className={btnSecondary}>
                      编辑
                    </button>
                    <button onClick={() => setConfirmTarget(t)} className={btnDanger}>
                      删除
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除班次模板"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？正在使用这个模板的排班表不受影响，但之后无法再选用它。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
