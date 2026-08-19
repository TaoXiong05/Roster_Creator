import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { BackLink } from '../components/BackLink';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { UnavailableDatesDialog } from '../components/UnavailableDatesDialog';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../utils/date';
import { btnDanger, btnSecondary, cardBase } from '../styles/ui';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Staff[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState(false);
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<Staff | null>(null);

  const load = async () => {
    if (!id) return;
    const [memberList, staffList] = await Promise.all([api.groups.listMembers(id), api.staff.list()]);
    setMembers(memberList);
    setAllStaff(staffList);
  };

  useEffect(() => {
    load();
  }, [id]);

  const memberIds = new Set(members.map((m) => m.id));
  const available = allStaff.filter((s) => !memberIds.has(s.id));

  const handleAdd = async (staffId: string) => {
    if (!id) return;
    setPendingId(staffId);
    try {
      await api.groups.addMember(id, staffId);
      await load();
    } finally {
      setPendingId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!id || !confirmTarget) return;
    setRemoving(true);
    try {
      await api.groups.removeMember(id, confirmTarget.id);
      setConfirmTarget(null);
      await load();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AppShell width="wide">
      <div className="space-y-6">
        <BackLink to="/groups" label={t('groups.backToGroups')} />
        <PageHeader title={t('groups.detailTitle')} description={t('groups.detailDescription')} />

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">{t('groups.membersHeading')}</h2>
          {members.length === 0 ? (
            <p className="text-sm text-ink-soft">{t('groups.noMembers')}</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {members.map((m) => {
                    const unavailableRanges = m.preference?.unavailableDateRanges ?? [];
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-sand/60">
                        <td className="px-4 py-2.5 text-ink">
                          <p>{m.name}</p>
                          {unavailableRanges.length > 0 && (
                            <p className="mt-0.5 text-xs text-ink-soft">
                              {t('groups.unavailablePrefix')}{unavailableRanges.map((r) => `${formatDate(r.start)}~${formatDate(r.end)}`).join(t('common.listSeparator'))}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setUnavailabilityTarget(m)} className={btnSecondary}>
                              {t('groups.setUnavailableDates')}
                            </button>
                            <button onClick={() => setConfirmTarget(m)} className={btnDanger}>
                              {t('groups.remove')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${cardBase} space-y-3`}>
          <h2 className="font-display text-base font-semibold text-ink">{t('groups.otherStaffHeading')}</h2>
          {available.length === 0 ? (
            <p className="text-sm text-ink-soft">{t('groups.noAvailableStaff')}</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-tan/15">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-tan/10">
                  {available.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-sand/60">
                      <td className="px-4 py-2.5 text-ink">{s.name}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleAdd(s.id)} disabled={pendingId === s.id} className={`gap-2 ${btnSecondary}`}>
                          {pendingId === s.id && <Spinner className="h-4 w-4" />}
                          {t('groups.join')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        title={t('groups.removeTitle')}
        message={t('groups.removeMessage', { name: confirmTarget?.name ?? '' })}
        confirmLabel={t('groups.removeConfirmLabel')}
        loading={removing}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={handleConfirmRemove}
      />

      <UnavailableDatesDialog
        open={!!unavailabilityTarget}
        staff={unavailabilityTarget}
        onClose={() => setUnavailabilityTarget(null)}
        onSaved={(updated) => setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
      />
    </AppShell>
  );
}
