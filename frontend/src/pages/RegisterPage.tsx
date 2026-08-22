// frontend/src/pages/RegisterPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/AuthLayout';
import { MailIcon, LockIcon } from '../components/AuthIcons';
import { Spinner } from '../components/Spinner';
import { useLanguage } from '../i18n/LanguageContext';
import { btnPrimary, errorText, fieldErrorText, inputBase, inputError, labelBase } from '../styles/ui';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailFieldError = error && /email/i.test(error) ? error : null;
  const bannerError = error && !emailFieldError ? error : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.register.registrationFailedError'));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      headline={t('auth.register.headline')}
      tagline={t('auth.register.tagline')}
      formEyebrow={t('auth.register.formEyebrow')}
      formTitle={t('auth.register.formTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {bannerError && (
          <p role="alert" className={errorText}>
            {bannerError}
          </p>
        )}

        <div>
          <label htmlFor="email" className={labelBase}>
            {t('auth.register.emailLabel')}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <MailIcon />
            </span>
            <input
              id="email"
              type="email"
              placeholder={t('auth.register.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${emailFieldError ? inputError : inputBase} pl-11`}
              required
            />
          </div>
          {emailFieldError && (
            <p role="alert" className={fieldErrorText}>
              {emailFieldError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className={labelBase}>
            {t('auth.register.passwordLabel')}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-tan">
              <LockIcon />
            </span>
            <input
              id="password"
              type="password"
              placeholder={t('auth.register.passwordPlaceholder')}
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
          {t('auth.register.submit')}
        </button>

        <p className="text-sm text-ink-soft">
          <Link to="/login" className="underline-offset-4 hover:text-coral-deep hover:underline">
            {t('auth.register.haveAccount')}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
