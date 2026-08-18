import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">欢迎，{user?.email}</h1>
      <nav className="flex gap-4 text-sm">
        <Link to="/staff" className="underline">
          员工管理
        </Link>
        <Link to="/groups" className="underline">
          小组管理
        </Link>
      </nav>
      <button onClick={() => logout()} className="border rounded px-3 py-2">
        登出
      </button>
    </div>
  );
}
