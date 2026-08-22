// frontend/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AuthLayout } from '../components/AuthLayout';
import { MailIcon } from '../components/AuthIcons';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, errorText, inputBase, labelBase, successText } from '../styles/ui';

export function ForgotPasswordPage() {
  const { t } = useLanguage();
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
      setError(err instanceof Error ? err.message : t('auth.forgotPassword.sendFailedError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline={t('auth.forgotPassword.headline')}
      tagline={t('auth.forgotPassword.tagline')}
      formEyebrow={t('auth.forgotPassword.formEyebrow')}
      formTitle={t('auth.forgotPassword.formTitle')}
    >
      {sent ? (
        <div className="space-y-4">
          <p className={successText}>{t('auth.forgotPassword.sentMessage')}</p>
          <Link to="/login" className="text-sm text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}
          <div>
            <label htmlFor="email" className={labelBase}>
              {t('auth.forgotPassword.emailLabel')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
                <MailIcon />
              </span>
              <input
                id="email"
                type="email"
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputBase} pl-11`}
                required
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className={`w-full gap-2 ${btnPrimary}`}>
            {loading && <Spinner className="h-4 w-4" />}
            {t('auth.forgotPassword.submit')}
          </button>
          <p className="text-sm text-ink-soft">
            <Link to="/login" className="underline-offset-4 hover:text-coral-deep hover:underline">
              {t('auth.forgotPassword.backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
