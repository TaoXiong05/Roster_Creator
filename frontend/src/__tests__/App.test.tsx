// frontend/src/__tests__/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import * as AuthContextModule from '../auth/AuthContext';
import { wrapWithQueryClient } from '../testUtils';

describe('App routing', () => {
  it('renders the login page at /login', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      wrapWithQueryClient(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      )
    );

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from /dashboard', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      wrapWithQueryClient(
        <MemoryRouter initialEntries={['/dashboard']}>
          <App />
        </MemoryRouter>
      )
    );

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('redirects authenticated users away from /login to /dashboard', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      wrapWithQueryClient(
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      )
    );

    expect(await screen.findByRole('heading', { name: /Hi there/ })).toBeInTheDocument();
  });

  it('redirects authenticated users away from /register to /dashboard', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });

    render(
      wrapWithQueryClient(
        <MemoryRouter initialEntries={['/register']}>
          <App />
        </MemoryRouter>
      )
    );

    expect(await screen.findByRole('heading', { name: /Hi there/ })).toBeInTheDocument();
  });
});
