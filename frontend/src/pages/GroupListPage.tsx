import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, StaffGroup } from '../api/client';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase, listRow } from '../styles/ui';

export function GroupListPage() {
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<StaffGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setGroups(await api.groups.list());

  useEffect(() => {
    load();
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
    const next = window.prompt('新的小组名称', currentName);
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
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="小组管理" description="把员工分组，一次性排进同一份班表" />

        <form onSubmit={handleCreate} className={`${cardBase} flex flex-col gap-3 sm:flex-row sm:items-end`}>
          <div className="sm:flex-1">
            <label htmlFor="group-name" className={labelBase}>
              小组名称
            </label>
            <input
              id="group-name"
              placeholder="小组名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <button type="submit" disabled={creating} className={`shrink-0 gap-2 ${btnPrimary}`}>
            {creating && <Spinner className="h-4 w-4" />}
            创建小组
          </button>
        </form>

        {groups.length === 0 ? (
          <p className="text-sm text-ink-soft">还没有小组，先在上面创建一个吧。</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id} className={listRow}>
                <div>
                  <p className="font-medium text-ink">{g.name}</p>
                  <p className="text-sm text-ink-soft">{g.memberCount} 名成员</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to={`/groups/${g.id}`} className={btnSecondary}>
                    管理成员
                  </Link>
                  <button onClick={() => handleRename(g.id, g.name)} className={btnSecondary}>
                    重命名
                  </button>
                  <button onClick={() => setConfirmTarget(g)} className={btnDanger}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title="删除小组"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
