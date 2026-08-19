import { useEffect, useState, FormEvent } from 'react';
import { api, Responsibility } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, listRow } from '../styles/ui';

export function ResponsibilityListPage() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Responsibility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => setResponsibilities(await api.responsibilities.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.responsibilities.create(name);
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
      await api.responsibilities.remove(confirmTarget.id);
      setConfirmTarget(null);
      await load();
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
      await load();
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="职责模板" description="定义员工可以承担的职责，员工管理里可以多选" />

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row sm:items-end`}>
          <div className="sm:flex-1">
            <label htmlFor="responsibility-name" className={labelBase}>
              职责名称
            </label>
            <input
              id="responsibility-name"
              placeholder="名称（如：收银）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            添加职责
          </button>
        </form>

        {responsibilities.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有职责模板，先在上面添加一个吧。</p>
        ) : (
          <ul className="space-y-3">
            {responsibilities.map((r) =>
              editingId === r.id ? (
                <li key={r.id} className={`${cardBase} space-y-3`}>
                  <form onSubmit={handleSaveEdit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="sm:flex-1">
                      <label htmlFor={`edit-responsibility-${r.id}`} className={labelBase}>
                        职责名称
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
                        保存
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={btnSecondary}>
                        取消
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={r.id} className={listRow}>
                  <span className="font-medium text-ink">{r.name}</span>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => startEdit(r)} className={btnSecondary}>
                      编辑
                    </button>
                    <button onClick={() => setConfirmTarget(r)} className={btnDanger}>
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
        title="删除职责"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？已经勾选这个职责的员工不受影响，但之后无法再选用它。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
