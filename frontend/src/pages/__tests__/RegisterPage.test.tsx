// frontend/src/pages/__tests__/RegisterPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';
import * as AuthContextModule from '../../auth/AuthContext';

describe('RegisterPage', () => {
  it('calls register with entered credentials', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText('密码（至少6位）'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith('a@b.com', 'password123'));
  });
});