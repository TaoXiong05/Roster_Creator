// frontend/src/testUtils.tsx
// Shared helpers for rendering components that rely on TanStack Query.
// `useQuery`/`useQueryClient` require a QueryClientProvider, so every test that
// mounts a page using the data-fetching layer must wrap it in one.
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactNode) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

// Wraps only with the QueryClientProvider (no router), so callers can keep
// their own MemoryRouter / Routes structure while still satisfying the
// required QueryClient context from useQuery/useQueryClient.
export function wrapWithQueryClient(ui: ReactNode) {
  return <QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>;
}

// Convenience provider component: wrap any JSX (e.g. an existing
// MemoryRouter/Routes tree) to supply the QueryClient context.
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}
