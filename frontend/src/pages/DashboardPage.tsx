// frontend/src/pages/DashboardPage.tsx
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">欢迎，{user?.email}</h1>
      <p className="text-gray-500">员工管理、排班创建等功能将在后续计划中加入这里。</p>
      <button onClick={() => logout()} className="border rounded px-3 py-2">
        登出
      </button>
    </div>
  );
}