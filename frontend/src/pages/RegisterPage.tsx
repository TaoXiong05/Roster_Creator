// frontend/src/pages/RegisterPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { MailIcon, LockIcon } from '../components/AuthIcons';
import { btnPrimary, errorText, inputBase, labelBase } from '../styles/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <AuthLayout
      headline="让我陪你把整个团队安排好"
      tagline="创建一个账号，开始记录员工、班次和排班表"
      formEyebrow="第一次来呀"
      formTitle="注册"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className={labelBase}>
            邮箱
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <MailIcon />
            </span>
            <input
              id="email"
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} pl-11`}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={labelBase}>
            密码
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <LockIcon />
            </span>
            <input
              id="password"
              type="password"
              placeholder="密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className={`${inputBase} pl-11`}
              required
            />
          </div>
        </div>

        <button type="submit" className={`w-full ${btnPrimary}`}>
          注册
        </button>

        <p className="text-sm text-ink-soft">
          <Link to="/login" className="underline-offset-4 hover:text-coral-deep hover:underline">
            已有账号？登录
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
