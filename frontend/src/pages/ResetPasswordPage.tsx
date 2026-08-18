// frontend/src/pages/ResetPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">重置密码</h1>
        {done ? (
          <p>密码已重置，请用新密码登录。</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="text-red-600 text-sm">
                {error}
              </p>
            )}
            <input
              type="password"
              placeholder="新密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full border rounded px-3 py-2"
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
              重置密码
            </button>
          </form>
        )}
      </div>
    </div>
  );
}