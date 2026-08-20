import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders the value, label, and links to the given route', () => {
    render(
      <MemoryRouter>
        <StatCard
          to="/staff"
          icon={<svg data-testid="icon" />}
          label="Staff"
          value={12}
          accentBg="bg-coral/15"
          accentText="text-coral-deep"
          accentLine="via-coral/50"
          border="border-coral/15"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /12/ })).toHaveAttribute('href', '/staff');
    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
