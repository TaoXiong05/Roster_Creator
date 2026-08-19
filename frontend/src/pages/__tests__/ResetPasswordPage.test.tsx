// frontend/src/pages/__tests__/ResetPasswordPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({ api: { confirmPasswordReset: vi.fn() } }));

describe('ResetPasswordPage', () => {
  it('reads the token from the query string and submits the new password', async () => {
    (api.confirmPasswordReset as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('New password (at least 6 characters)'), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => expect(api.confirmPasswordReset).toHaveBeenCalledWith('abc123', 'newpassword123'));
    expect(screen.getByText(/Your password has been reset/)).toBeInTheDocument();
  });
});