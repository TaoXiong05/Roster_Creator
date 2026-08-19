// frontend/src/pages/ResetPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { LockIcon } from '../components/AuthIcons';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, errorText, inputBase, labelBase, successText } from '../styles/ui';

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline={t('auth.resetPassword.headline')}
      tagline={t('auth.resetPassword.tagline')}
      formEyebrow={t('auth.resetPassword.formEyebrow')}
      formTitle={t('auth.resetPassword.formTitle')}
    >
      {done ? (
        <div className="space-y-4">
          <p className={successText}>{t('auth.resetPassword.doneMessage')}</p>
          <Link to="/login" className="text-sm text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {t('auth.resetPassword.backToLogin')}
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
              {t('auth.resetPassword.newPasswordLabel')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
                <LockIcon />
              </span>
              <input
                id="password"
                type="password"
                placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className={`${inputBase} pl-11`}
                required
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className={`w-full gap-2 ${btnPrimary}`}>
            {loading && <Spinner className="h-4 w-4" />}
            {t('auth.resetPassword.submit')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
