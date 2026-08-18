// frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({ api: { requestPasswordReset: vi.fn() } }));

describe('ForgotPasswordPage', () => {
  it('submits the email and shows a confirmation message', async () => {
    (api.requestPasswordReset as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    expect(api.requestPasswordReset).toHaveBeenCalledWith('a@b.com');
    await waitFor(() => expect(screen.getByText(/如果该邮箱存在/)).toBeInTheDocument());
  });
});