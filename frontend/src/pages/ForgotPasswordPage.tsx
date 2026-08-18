// frontend/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { api } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.requestPasswordReset(email);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">忘记密码</h1>
        {sent ? (
          <p>如果该邮箱存在，我们已经发送了重置链接，请查收邮件。</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
              发送重置链接
            </button>
          </form>
        )}
      </div>
    </div>
  );
}