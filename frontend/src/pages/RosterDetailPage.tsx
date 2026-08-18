import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail } from '../api/client';

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    api.rosters.get(id).then(setRoster);
  }, [id]);

  if (!roster) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">{roster.name}</h1>
      <p className="text-sm text-gray-500">
        {roster.dateRangeStart.slice(0, 10)} ~ {roster.dateRangeEnd.slice(0, 10)} · 状态：{roster.status}
      </p>
      <ul className="divide-y">
        {roster.rosterShifts.map((rs) => (
          <li key={rs.id} className="py-3">
            <p className="font-medium">
              {rs.date.slice(0, 10)} · {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
            </p>
            <p className="text-sm text-gray-500">
              需要 {rs.headcount} 人{rs.requiredSkills.length > 0 ? ` · 技能: ${rs.requiredSkills.join(', ')}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
