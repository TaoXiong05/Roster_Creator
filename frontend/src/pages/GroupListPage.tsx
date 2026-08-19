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
import { btnDanger, btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from '../styles/ui';

export function GroupListPage() {
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
    <AppShell width="wide">
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

        {loading ? (
          <PageSkeleton rows={3} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<KangarooMascot variant="badge" animated={false} className="h-16 w-16" />}
            title="还没有小组"
            description="在上方输入名称，创建第一个小组来归拢员工。"
          />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-tan/15 bg-white/85 shadow-warm-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tan/15 bg-sand text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3">小组名称</th>
                  <th className="px-5 py-3">成员数</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tan/10">
                {groups.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-sand/70">
                    <td className="px-5 py-3 font-medium text-ink">{g.name}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {g.memberCount} 名成员
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
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
        title="删除小组"
        message={`确定要删除「${confirmTarget?.name ?? ''}」吗？此操作不可撤销。`}
        loading={deleting}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
