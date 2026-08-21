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
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText('Password (at least 6 characters)'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith('a@b.com', 'password123'));
  });
});