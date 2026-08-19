import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeInput } from '../TimeInput';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <TimeInput id="time" value={value} onChange={setValue} placeholder="06:00" />
      <span data-testid="value">{value}</span>
    </div>
  );
}

describe('TimeInput', () => {
  it('auto-inserts a colon after the first two digits are typed', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByRole('textbox'), '0600');

    expect(screen.getByTestId('value')).toHaveTextContent('06:00');
    expect(screen.getByRole('textbox')).toHaveValue('06:00');
  });

  it('strips a manually typed colon and re-inserts it in the right place', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByRole('textbox'), '14:30');

    expect(screen.getByTestId('value')).toHaveTextContent('14:30');
  });

  it('opens the clock picker on the hour face when the clock button is clicked', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));

    expect(screen.getByRole('button', { name: 'Hour 06' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hour 18' })).toBeInTheDocument();
  });

  it('selecting an hour sets it and switches to the minute face', async () => {
    render(<Harness initial="00:00" />);

    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hour 14' }));

    expect(screen.getByTestId('value')).toHaveTextContent('14:00');
    expect(screen.getByRole('button', { name: 'Minute 30' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hour 06' })).not.toBeInTheDocument();
  });

  it('selecting a minute sets it and closes the picker', async () => {
    render(<Harness initial="14:00" />);

    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hour 14' }));
    await userEvent.click(screen.getByRole('button', { name: 'Minute 30' }));

    expect(screen.getByTestId('value')).toHaveTextContent('14:30');
    expect(screen.getByRole('textbox')).toHaveValue('14:30');
    expect(screen.queryByRole('button', { name: 'Minute 30' })).not.toBeInTheDocument();
  });

  it('closes the picker without changing the value when clicking outside', async () => {
    render(
      <div>
        <Harness initial="09:00" />
        <button type="button">outside</button>
      </div>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));
    expect(screen.getByRole('button', { name: 'Hour 09' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('button', { name: 'Hour 09' })).not.toBeInTheDocument();
    expect(screen.getByTestId('value')).toHaveTextContent('09:00');
  });
});
