import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';

export function RosterListPage() {
  const [rosters, setRosters] = useState<RosterListItem[]>([]);

  useEffect(() => {
    api.rosters.list().then(setRosters);
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">排班表</h1>
        <Link to="/rosters/new" className="bg-blue-600 text-white rounded px-4 py-2 text-sm">
          创建排班
        </Link>
      </div>
      <ul className="divide-y">
        {rosters.map((r) => (
          <li key={r.id} className="py-3">
            <Link to={`/rosters/${r.id}`} className="font-medium underline">
              {r.name}
            </Link>
            <p className="text-sm text-gray-500">
              {r.groupName} · {r.dateRangeStart.slice(0, 10)} ~ {r.dateRangeEnd.slice(0, 10)} · {r.shiftCount} 个班次 ·{' '}
              {r.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
