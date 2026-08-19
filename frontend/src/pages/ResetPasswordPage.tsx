// frontend/src/pages/ResetPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { LockIcon } from '../components/AuthIcons';
import { btnPrimary, errorText, inputBase, labelBase, successText } from '../styles/ui';

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
    <AuthLayout
      headline="马上就能拿到新钥匙啦"
      tagline="设置一个新密码，就能回到工作台"
      formEyebrow="重置密码"
      formTitle="设置新密码"
    >
      {done ? (
        <div className="space-y-4">
          <p className={successText}>密码已重置，请用新密码登录。</p>
          <Link to="/login" className="text-sm text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            返回登录
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}
          <div>
            <label htmlFor="password" className={labelBase}>
              新密码
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
                <LockIcon />
              </span>
              <input
                id="password"
                type="password"
                placeholder="新密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className={`${inputBase} pl-11`}
                required
              />
            </div>
          </div>
          <button type="submit" className={`w-full ${btnPrimary}`}>
            重置密码
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
