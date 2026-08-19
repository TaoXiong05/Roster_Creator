import { useEffect, useState, FormEvent } from 'react';
import { api, Responsibility } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { PageSkeleton } from '../components/Skeleton';
import { Spinner } from '../components/Spinner';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';

export function ResponsibilityListPage() {
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Responsibility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => setResponsibilities(await api.responsibilities.list());

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
    <AppShell width="wide">
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

        {loading ? (
          <PageSkeleton rows={3} />
        ) : responsibilities.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title="还没有职责模板"
            description="在上方添加一个职责，员工管理里就可以多选了。"
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">职责名称</th>
                  <th className="px-5 py-3 text-right">操作</th>
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
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="transition-colors hover:bg-sand/70">
                      <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => startEdit(r)} className={btnSecondary}>
                            编辑
                          </button>
                          <button onClick={() => setConfirmTarget(r)} className={btnDanger}>
                            删除
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
        title="删除职责"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？已经勾选这个职责的员工不受影响，但之后无法再选用它。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
