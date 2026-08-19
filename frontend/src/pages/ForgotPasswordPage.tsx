// frontend/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { MailIcon } from '../components/AuthIcons';
import { Spinner } from '../components/Spinner';
import { btnPrimary, errorText, inputBase, labelBase, successText } from '../styles/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline="钥匙丢了没关系，我来帮你找"
      tagline="留下邮箱，重置链接马上就送到"
      formEyebrow="找回密码"
      formTitle="忘记密码"
    >
      {sent ? (
        <div className="space-y-4">
          <p className={successText}>如果该邮箱存在，我们已经发送了重置链接，请查收邮件。</p>
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
          <button type="submit" disabled={loading} className={`w-full gap-2 ${btnPrimary}`}>
            {loading && <Spinner className="h-4 w-4" />}
            发送重置链接
          </button>
          <p className="text-sm text-ink-soft">
            <Link to="/login" className="underline-offset-4 hover:text-coral-deep hover:underline">
              返回登录
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
