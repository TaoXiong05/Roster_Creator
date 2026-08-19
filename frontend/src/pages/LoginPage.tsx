// frontend/src/pages/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { MailIcon, LockIcon } from '../components/AuthIcons';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, btnSecondary, errorText, inputBase, labelBase } from '../styles/ui';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline={t('auth.login.headline')}
      tagline={t('auth.login.tagline')}
      formEyebrow={t('auth.login.formEyebrow')}
      formTitle={t('auth.login.formTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className={errorText}>
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className={labelBase}>
            {t('auth.login.emailLabel')}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <MailIcon />
            </span>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} pl-11`}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className={labelBase}>
            {t('auth.login.passwordLabel')}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <LockIcon />
            </span>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputBase} pl-11`}
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={`w-full gap-2 ${btnPrimary}`}>
          {loading && <Spinner className="h-4 w-4" />}
          {t('auth.login.submit')}
        </button>

        <div className="flex items-center justify-between text-sm text-ink-soft">
          <Link to="/register" className="underline-offset-4 hover:text-coral-deep hover:underline">
            {t('auth.login.noAccount')}
          </Link>
          <Link to="/forgot-password" className="underline-offset-4 hover:text-coral-deep hover:underline">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-widest text-ink-soft/50">
          <span className="h-px flex-1 bg-tan/25" />
          {t('auth.login.or')}
          <span className="h-px flex-1 bg-tan/25" />
        </div>

        <a href={`${API_BASE}/auth/google`} className={`w-full ${btnSecondary}`}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A11.99 11.99 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
          </svg>
          {t('auth.login.googleSubmit')}
        </a>
      </form>
    </AuthLayout>
  );
}
